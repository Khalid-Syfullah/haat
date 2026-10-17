import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PaymentStatus, Prisma } from '@prisma/client';
import { EngagementService } from '../common/engagement.service';
import { randomToken } from '../common/utils';
import { OrderWorkflowService } from '../orders/order-workflow.service';
import { PrismaService } from '../prisma/prisma.service';
import { SslCommerzClient, SslValidation } from './sslcommerz.client';

export type ProviderName = 'mock' | 'sslcommerz';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  readonly ssl = new SslCommerzClient();

  constructor(
    private readonly prisma: PrismaService,
    private readonly workflow: OrderWorkflowService,
    private readonly engagement: EngagementService,
  ) {}

  get provider(): ProviderName {
    return process.env.PAYMENT_PROVIDER === 'sslcommerz' ? 'sslcommerz' : 'mock';
  }

  private webUrl(path: string) {
    return `${process.env.WEB_URL || 'http://localhost:3000'}${path}`;
  }

  private apiUrl(path: string) {
    return `${process.env.API_PUBLIC_URL || 'http://localhost:4000'}/api${path}`;
  }

  /** Starts (or resumes) an online payment and returns where to send the customer. */
  async initiate(userId: string, orderNo: string, idempotencyKey?: string) {
    const order = await this.prisma.order.findFirst({
      where: { orderNo, userId },
      include: { items: true, user: true },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (order.status !== 'AWAITING_PAYMENT') throw new BadRequestException('This order does not need payment');
    if (order.expiresAt && order.expiresAt < new Date()) throw new BadRequestException('The payment window for this order has closed');

    const key = idempotencyKey ? `${order.id}:${idempotencyKey.slice(0, 64)}` : `${order.id}:${randomToken(8)}`;
    const existing = await this.prisma.payment.findUnique({ where: { idempotencyKey: key } });
    if (existing?.sessionKey && existing.status === 'PENDING') {
      return { provider: existing.provider, redirectUrl: this.redirectFor(existing.provider, existing.sessionKey, existing.raw) };
    }

    const payment = await this.prisma.payment.create({
      data: {
        orderId: order.id,
        method: order.paymentMethod,
        provider: this.provider,
        amount: order.total,
        status: PaymentStatus.PENDING,
        idempotencyKey: key,
      },
    });

    if (this.provider === 'mock') {
      const sessionKey = randomToken(16);
      await this.prisma.payment.update({ where: { id: payment.id }, data: { sessionKey } });
      return { provider: 'mock', redirectUrl: this.webUrl(`/payment/mock?session=${sessionKey}`) };
    }

    if (!this.ssl.configured) throw new BadRequestException('Online payment is not configured yet');
    try {
      const session = await this.ssl.createSession({
        tranId: payment.id,
        amount: order.total,
        successUrl: this.apiUrl('/payments/sslcommerz/success'),
        failUrl: this.apiUrl('/payments/sslcommerz/fail'),
        cancelUrl: this.apiUrl('/payments/sslcommerz/cancel'),
        ipnUrl: this.apiUrl('/payments/sslcommerz/ipn'),
        customer: {
          name: order.shipName,
          email: order.user.email || `${order.shipPhone}@customers.tuktakbazaar.example`,
          phone: order.shipPhone,
          address: `${order.shipLine}, ${order.shipArea}`,
          city: order.shipDistrict,
        },
        productName: order.items.map((i) => i.title).join(', '),
        itemCount: order.items.reduce((s, i) => s + i.quantity, 0),
      });
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { sessionKey: session.sessionKey, raw: { gatewayUrl: session.gatewayUrl } },
      });
      return { provider: 'sslcommerz', redirectUrl: session.gatewayUrl };
    } catch (err) {
      this.logger.error(err);
      await this.prisma.payment.update({ where: { id: payment.id }, data: { status: PaymentStatus.FAILED } });
      throw new BadRequestException('Could not reach the payment gateway. Try again in a minute.');
    }
  }

  private redirectFor(provider: string, sessionKey: string, raw: Prisma.JsonValue | null) {
    if (provider === 'mock') return this.webUrl(`/payment/mock?session=${sessionKey}`);
    return (raw as { gatewayUrl?: string } | null)?.gatewayUrl ?? this.webUrl('/account/orders');
  }

  /** Marks a payment paid exactly once and moves the order forward. Safe to call repeatedly. */
  async markPaid(paymentId: string, details: { providerTxnId?: string; valId?: string; raw?: unknown }) {
    return this.prisma.$transaction(async (tx) => {
      const res = await tx.payment.updateMany({
        where: { id: paymentId, status: { not: PaymentStatus.PAID } },
        data: {
          status: PaymentStatus.PAID,
          providerTxnId: details.providerTxnId,
          valId: details.valId,
          raw: (details.raw ?? undefined) as Prisma.InputJsonValue | undefined,
        },
      });
      const payment = await tx.payment.findUniqueOrThrow({ where: { id: paymentId }, include: { order: true } });
      if (res.count === 0) return payment.order; // already handled
      const order = payment.order;

      if (order.status === 'AWAITING_PAYMENT') {
        await tx.order.update({ where: { id: order.id }, data: { paymentStatus: PaymentStatus.PAID } });
        await this.workflow.transitionTx(tx, order.id, 'PLACED', { actor: 'system', note: `Paid ৳${payment.amount} online` });
        await this.workflow.transitionTx(tx, order.id, 'CONFIRMED', { actor: 'system', note: 'Prepaid orders confirm automatically' });
      } else {
        // Money arrived after the order was cancelled (e.g. payment window expired): flag a refund.
        await tx.order.update({ where: { id: order.id }, data: { paymentStatus: PaymentStatus.REFUND_PENDING } });
        await tx.orderEvent.create({
          data: { orderId: order.id, title: 'Payment received after cancellation', note: 'Refund due to the customer', actor: 'system' },
        });
        await this.engagement.notify(tx, order.userId, {
          type: 'order',
          title: 'Refund on the way',
          body: `We received ৳${payment.amount} for cancelled order ${order.orderNo}. It will be refunded.`,
          link: `/account/orders/${order.orderNo}`,
        });
      }
      return tx.order.findUniqueOrThrow({ where: { id: order.id } });
    });
  }

  async markFailed(paymentId: string, raw?: unknown) {
    await this.prisma.payment.updateMany({
      where: { id: paymentId, status: PaymentStatus.PENDING },
      data: { status: PaymentStatus.FAILED, raw: (raw ?? undefined) as Prisma.InputJsonValue | undefined },
    });
  }

  // ───── Mock gateway (local development) ─────

  async mockSession(userId: string, sessionKey: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { sessionKey, provider: 'mock', order: { userId } },
      include: { order: true },
    });
    if (!payment) throw new NotFoundException('Payment session not found');
    return {
      orderNo: payment.order.orderNo,
      amount: payment.amount,
      method: payment.method,
      status: payment.status,
      expiresAt: payment.order.expiresAt,
    };
  }

  async mockComplete(userId: string, sessionKey: string, outcome: 'success' | 'fail') {
    const payment = await this.prisma.payment.findFirst({
      where: { sessionKey, provider: 'mock', order: { userId } },
      include: { order: true },
    });
    if (!payment) throw new NotFoundException('Payment session not found');
    if (outcome === 'success') {
      await this.markPaid(payment.id, { providerTxnId: `MOCK-${randomToken(6)}`, raw: { mock: true } });
    } else {
      await this.markFailed(payment.id, { mock: true, outcome });
    }
    return { orderNo: payment.order.orderNo, outcome };
  }

  // ───── SSLCommerz callbacks ─────

  /** Validates a val_id with SSLCommerz and checks it matches our payment before marking it paid. */
  async confirmSsl(tranId: string, valId: string) {
    const payment = await this.prisma.payment.findUnique({ where: { id: tranId }, include: { order: true } });
    if (!payment) throw new NotFoundException('Unknown transaction');
    let check: SslValidation;
    try {
      check = await this.ssl.validate(valId);
    } catch (err) {
      this.logger.error(err);
      return { order: payment.order, paid: false };
    }
    const ok =
      (check.status === 'VALID' || check.status === 'VALIDATED') &&
      check.tran_id === payment.id &&
      Math.round(Number(check.amount)) === payment.amount &&
      check.currency === 'BDT';
    if (!ok) {
      this.logger.warn(`SSLCommerz validation mismatch for ${payment.id}: ${JSON.stringify(check)}`);
      return { order: payment.order, paid: false };
    }
    const order = await this.markPaid(payment.id, { providerTxnId: check.bank_tran_id, valId, raw: check });
    return { order, paid: true };
  }

  async orderNoForPayment(paymentId: string) {
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId }, include: { order: { select: { orderNo: true } } } });
    return payment?.order.orderNo ?? null;
  }

  /** Re-checks SSLCommerz payments whose callbacks may have been lost. */
  async reconcile() {
    if (this.provider !== 'sslcommerz' || !this.ssl.configured) return 0;
    const pending = await this.prisma.payment.findMany({
      where: { provider: 'sslcommerz', status: PaymentStatus.PENDING, createdAt: { lt: new Date(Date.now() - 2 * 60 * 1000) } },
      take: 50,
    });
    let fixed = 0;
    for (const payment of pending) {
      try {
        const rows = await this.ssl.queryByTranId(payment.id);
        const valid = rows.find((r) => r.status === 'VALID' || r.status === 'VALIDATED');
        if (valid && Math.round(Number(valid.amount)) === payment.amount) {
          await this.markPaid(payment.id, { providerTxnId: valid.bank_tran_id, valId: valid.val_id, raw: valid });
          fixed++;
        } else if (rows.some((r) => r.status === 'FAILED' || r.status === 'CANCELLED')) {
          await this.markFailed(payment.id, rows);
        }
      } catch (err) {
        this.logger.warn(`Reconcile failed for ${payment.id}: ${String(err)}`);
      }
    }
    return fixed;
  }
}
