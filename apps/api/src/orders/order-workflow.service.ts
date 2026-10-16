import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CoinReason, MovementReason, Order, OrderItem, OrderStatus, PaymentMethod, PaymentStatus, Prisma } from '@prisma/client';
import { EngagementService } from '../common/engagement.service';
import { SettingsService } from '../common/settings.service';
import { Db, PrismaService } from '../prisma/prisma.service';

export type Actor = 'system' | 'customer' | 'admin';

/** Every allowed move between order states. Anything else is refused. */
export const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  AWAITING_PAYMENT: ['PLACED', 'CANCELLED'],
  PLACED: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PACKED', 'CANCELLED'],
  PACKED: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED', 'DELIVERY_FAILED'],
  DELIVERED: [],
  CANCELLED: [],
  DELIVERY_FAILED: [],
};

/** States a customer may cancel from (before packing). */
export const CUSTOMER_CANCELLABLE: OrderStatus[] = ['AWAITING_PAYMENT', 'PLACED', 'CONFIRMED'];

export const STATUS_TITLES: Record<OrderStatus, string> = {
  AWAITING_PAYMENT: 'Waiting for payment',
  PLACED: 'Order placed',
  CONFIRMED: 'Order confirmed',
  PACKED: 'Packed and ready to ship',
  SHIPPED: 'Handed to courier',
  DELIVERED: 'Delivered',
  CANCELLED: 'Order cancelled',
  DELIVERY_FAILED: 'Delivery failed',
};

export interface TransitionInput {
  actor: Actor;
  actorId?: string;
  note?: string;
  reason?: string;
  courier?: string;
  trackingNo?: string;
}

type OrderWithItems = Order & { items: OrderItem[] };

@Injectable()
export class OrderWorkflowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly engagement: EngagementService,
    private readonly settings: SettingsService,
  ) {}

  async transition(orderId: string, to: OrderStatus, input: TransitionInput) {
    return this.prisma.$transaction((tx) => this.transitionTx(tx, orderId, to, input), { timeout: 15000 });
  }

  /** Runs one state change inside an existing transaction. */
  async transitionTx(tx: Db, orderId: string, to: OrderStatus, input: TransitionInput) {
    const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } });
    if (!order) throw new NotFoundException('Order not found');
    const from = order.status;
    if (!TRANSITIONS[from].includes(to)) {
      throw new BadRequestException(`An order that is ${STATUS_TITLES[from].toLowerCase()} can't move to "${STATUS_TITLES[to].toLowerCase()}"`);
    }

    const now = new Date();
    const data: Prisma.OrderUpdateInput = { status: to };
    let eventNote = input.note;

    switch (to) {
      case 'PLACED':
        data.expiresAt = null;
        break;
      case 'CONFIRMED':
        data.confirmedAt = now;
        data.needsCall = false;
        break;
      case 'PACKED':
        data.packedAt = now;
        break;
      case 'SHIPPED': {
        const courier = input.courier?.trim();
        const trackingNo = input.trackingNo?.trim();
        if (!courier || !trackingNo) throw new BadRequestException('Courier and tracking number are required to ship');
        Object.assign(data, { shippedAt: now, courier, trackingNo });
        eventNote = eventNote || `${courier} · tracking ${trackingNo}`;
        break;
      }
      case 'DELIVERED':
        data.deliveredAt = now;
        if (order.paymentMethod === PaymentMethod.COD) data.paymentStatus = PaymentStatus.PAID;
        break;
      case 'CANCELLED':
      case 'DELIVERY_FAILED':
        data.cancelledAt = now;
        data.cancelReason = input.reason || input.note || null;
        data.expiresAt = null;
        if (order.paymentStatus === PaymentStatus.PAID) data.paymentStatus = PaymentStatus.REFUND_PENDING;
        eventNote = eventNote || input.reason;
        break;
    }

    // Optimistic lock on the state we read: a concurrent change makes this a no-op.
    const updated = await tx.order.updateMany({ where: { id: order.id, status: from }, data: data as Prisma.OrderUpdateManyMutationInput });
    if (updated.count !== 1) throw new ConflictException('This order changed a moment ago. Refresh and try again.');

    if (to === 'CANCELLED' || to === 'DELIVERY_FAILED') {
      await this.release(tx, order, to === 'CANCELLED' ? MovementReason.CANCEL : MovementReason.DELIVERY_FAILED, input.actorId);
      await tx.payment.updateMany({ where: { orderId: order.id, status: PaymentStatus.PENDING }, data: { status: PaymentStatus.FAILED } });
    }
    if (to === 'DELIVERED') await this.onDelivered(tx, order);

    await tx.orderEvent.create({
      data: { orderId: order.id, status: to, title: STATUS_TITLES[to], note: eventNote, actor: input.actor },
    });
    await this.engagement.notify(tx, order.userId, this.customerMessage(order, to, input));
    return tx.order.findUnique({ where: { id: order.id } });
  }

  /** Put stock, flash-sale quota, voucher use and coins back after a cancellation or failed delivery. */
  private async release(tx: Db, order: OrderWithItems, reason: MovementReason, actorId?: string) {
    for (const item of order.items) {
      await tx.productVariant.update({ where: { id: item.variantId }, data: { stock: { increment: item.quantity } } });
      await tx.inventoryMovement.create({
        data: { variantId: item.variantId, delta: item.quantity, reason, refId: order.id, note: `Order ${order.orderNo}`, createdById: actorId },
      });
      if (item.flashSaleItemId) {
        await tx.flashSaleItem.updateMany({
          where: { id: item.flashSaleItemId, soldQty: { gte: item.quantity } },
          data: { soldQty: { decrement: item.quantity } },
        });
      }
    }
    const redemption = await tx.voucherRedemption.findUnique({ where: { orderId: order.id } });
    if (redemption && !redemption.reversedAt) {
      await tx.voucherRedemption.update({ where: { id: redemption.id }, data: { reversedAt: new Date() } });
      await tx.voucher.updateMany({ where: { id: redemption.voucherId, usedCount: { gt: 0 } }, data: { usedCount: { decrement: 1 } } });
    }
    if (order.coinsUsed > 0) {
      await this.engagement.credit(tx, order.userId, order.coinsUsed, CoinReason.REFUND, `Order ${order.orderNo} cancelled`, order.id);
    }
  }

  private async onDelivered(tx: Db, order: OrderWithItems) {
    const byProduct = new Map<string, number>();
    for (const item of order.items) byProduct.set(item.productId, (byProduct.get(item.productId) ?? 0) + item.quantity);
    for (const [productId, qty] of byProduct) {
      await tx.product.update({ where: { id: productId }, data: { soldCount: { increment: qty } } });
    }
    await tx.payment.updateMany({
      where: { orderId: order.id, provider: 'cod', status: PaymentStatus.PENDING },
      data: { status: PaymentStatus.PAID },
    });
    if (!order.coinsAwarded) {
      const { coins } = await this.settings.get();
      const reward = Math.floor((order.total * coins.orderRewardPercent) / 100);
      if (reward > 0) {
        await this.engagement.credit(tx, order.userId, reward, CoinReason.ORDER_REWARD, `Order ${order.orderNo} delivered`, order.id);
      }
      await tx.order.update({ where: { id: order.id }, data: { coinsAwarded: true } });
    }
  }

  private customerMessage(order: Order, to: OrderStatus, input: TransitionInput) {
    const link = `/account/orders/${order.orderNo}`;
    const no = order.orderNo;
    switch (to) {
      case 'PLACED':
        return { type: 'order', title: 'Payment received', body: `We received your payment for order ${no}.`, link };
      case 'CONFIRMED':
        return { type: 'order', title: 'Order confirmed', body: `Order ${no} is confirmed and will be packed soon.`, link };
      case 'PACKED':
        return { type: 'order', title: 'Order packed', body: `Order ${no} is packed and waiting for the courier.`, link };
      case 'SHIPPED':
        return { type: 'order', title: 'On the way', body: `Order ${no} is with ${input.courier}. Tracking: ${input.trackingNo}.`, link };
      case 'DELIVERED':
        return { type: 'order', title: 'Delivered', body: `Order ${no} was delivered. Rate your items to earn coins.`, link: '/account/reviews' };
      case 'CANCELLED':
        return { type: 'order', title: 'Order cancelled', body: `Order ${no} was cancelled${input.reason ? `: ${input.reason}` : '.'}`, link };
      case 'DELIVERY_FAILED':
        return { type: 'order', title: 'Delivery failed', body: `The courier couldn't deliver order ${no}. Contact us to reorder.`, link };
      default:
        return { type: 'order', title: STATUS_TITLES[to], body: `Order ${no}: ${STATUS_TITLES[to]}.`, link };
    }
  }
}
