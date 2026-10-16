import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import {
  Address,
  CoinReason,
  DeliveryZone,
  MovementReason,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
  Voucher,
} from '@prisma/client';
import { EngagementService } from '../common/engagement.service';
import { ZONE_LABELS, zoneForDistrict } from '../common/locations';
import { PricingService } from '../common/pricing.service';
import { AppSettings, SettingsService } from '../common/settings.service';
import { clamp, generateOrderNo, variantLabel } from '../common/utils';
import { Db, PrismaService } from '../prisma/prisma.service';

export interface QuoteInput {
  addressId?: string;
  voucherCode?: string;
  useCoins?: boolean;
  paymentMethod?: PaymentMethod;
  buyNow?: { variantId: string; quantity: number };
}

export interface PlaceInput extends QuoteInput {
  addressId: string;
  paymentMethod: PaymentMethod;
  note?: string;
}

export interface QuoteLine {
  variantId: string;
  productId: string;
  slug: string;
  title: string;
  variantLabel: string | null;
  image: string | null;
  unitPrice: number;
  originalPrice: number;
  quantity: number;
  lineTotal: number;
  flashSaleItemId: string | null;
  flashQuantityLimit: number | null;
  stock: number;
  issue: string | null;
}

interface VoucherResult {
  id: string;
  code: string;
  title: string;
  type: string;
  discount: number;
  shippingDiscount: number;
  error: string | null;
}

const OPEN_STATUSES: OrderStatus[] = ['PLACED', 'CONFIRMED', 'PACKED', 'SHIPPED'];

@Injectable()
export class CheckoutService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: PricingService,
    private readonly settings: SettingsService,
    private readonly engagement: EngagementService,
  ) {}

  /**
   * COD refusal risk, 0–100, from the customer's and the phone number's history.
   * See "Bangladesh-specific design" in the spec for the point table.
   */
  async riskScore(db: Db, userId: string, phone: string, total: number): Promise<number> {
    const mine = { OR: [{ userId }, { shipPhone: phone }] };
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [delivered, failed, lateCancels, openCod] = await Promise.all([
      db.order.count({ where: { ...mine, status: 'DELIVERED' } }),
      db.order.count({ where: { ...mine, status: 'DELIVERY_FAILED' } }),
      db.order.count({ where: { ...mine, status: 'CANCELLED', confirmedAt: { not: null }, cancelledAt: { gt: since } } }),
      db.order.count({ where: { ...mine, paymentMethod: 'COD', status: { in: OPEN_STATUSES } } }),
    ]);
    let score = 0;
    if (delivered === 0) score += 20;
    score += Math.min(60, failed * 30);
    score += lateCancels * 10;
    if (total > 5000) score += 15;
    if (openCod >= 2) score += 15;
    score -= delivered * 10;
    return clamp(score, 0, 100);
  }

  private async lines(db: Db, userId: string, input: QuoteInput): Promise<QuoteLine[]> {
    const include = { product: { include: { images: { orderBy: { sortOrder: 'asc' as const }, take: 1 } } } };
    let raw: { variant: Prisma.ProductVariantGetPayload<{ include: typeof include }>; quantity: number }[];
    if (input.buyNow) {
      const variant = await db.productVariant.findUnique({ where: { id: input.buyNow.variantId }, include });
      if (!variant) throw new BadRequestException('This item is not available');
      raw = [{ variant, quantity: input.buyNow.quantity }];
    } else {
      const items = await db.cartItem.findMany({
        where: { cart: { userId }, selected: true },
        include: { variant: { include } },
        orderBy: { addedAt: 'desc' },
      });
      raw = items.map((i) => ({ variant: i.variant, quantity: i.quantity }));
    }

    const flashMap = await this.pricing.activeFlash(raw.map((r) => r.variant.id), db);
    const lines: QuoteLine[] = [];
    for (const { variant, quantity } of raw) {
      const product = variant.product;
      const info = this.pricing.price(variant, flashMap.get(variant.id));
      let issue: string | null = null;
      if (!variant.isActive || product.status !== 'ACTIVE') issue = 'No longer available';
      else if (variant.stock <= 0) issue = 'Out of stock';
      else if (variant.stock < quantity) issue = `Only ${variant.stock} left`;

      if (!issue && info.flash) {
        const bought = await db.orderItem.aggregate({
          _sum: { quantity: true },
          where: {
            flashSaleItemId: info.flash.id,
            order: { userId, status: { notIn: ['CANCELLED', 'DELIVERY_FAILED'] } },
          },
        });
        const already = bought._sum.quantity ?? 0;
        if (already + quantity > info.flash.perUserLimit) {
          issue = `Flash price is limited to ${info.flash.perUserLimit} per customer${already ? ` (you have bought ${already})` : ''}`;
        } else if (info.flash.soldQty + quantity > info.flash.quantityLimit) {
          issue = `Only ${info.flash.quantityLimit - info.flash.soldQty} left at the flash price`;
        }
      }

      lines.push({
        variantId: variant.id,
        productId: product.id,
        slug: product.slug,
        title: product.title,
        variantLabel: variantLabel(variant.options),
        image: variant.imageUrl ?? product.images[0]?.url ?? null,
        unitPrice: info.unitPrice,
        originalPrice: info.originalPrice,
        quantity,
        lineTotal: info.unitPrice * quantity,
        flashSaleItemId: info.flash?.id ?? null,
        flashQuantityLimit: info.flash?.quantityLimit ?? null,
        stock: variant.stock,
        issue,
      });
    }
    return lines;
  }

  private async checkVoucher(
    db: Db,
    voucher: Voucher | null,
    userId: string,
    subtotal: number,
    shippingLeft: number,
  ): Promise<VoucherResult | null> {
    if (!voucher) return null;
    const base = { id: voucher.id, code: voucher.code, title: voucher.title, type: voucher.type, discount: 0, shippingDiscount: 0 };
    const now = new Date();
    const fail = (error: string): VoucherResult => ({ ...base, error });
    if (!voucher.isActive || voucher.startsAt > now) return fail('This voucher is not active yet');
    if (voucher.endsAt <= now) return fail('This voucher has expired');
    if (voucher.usageLimit != null && voucher.usedCount >= voucher.usageLimit) return fail('This voucher has been fully used');
    const used = await db.voucherRedemption.count({ where: { voucherId: voucher.id, userId, reversedAt: null } });
    if (used >= voucher.perUserLimit) return fail('You have already used this voucher');
    if (subtotal < voucher.minSpend) return fail(`Spend ৳${voucher.minSpend - subtotal} more to use this voucher`);

    if (voucher.type === 'PERCENT') {
      let discount = Math.floor((subtotal * voucher.value) / 100);
      if (voucher.maxDiscount != null) discount = Math.min(discount, voucher.maxDiscount);
      return { ...base, discount, error: null };
    }
    if (voucher.type === 'FIXED') return { ...base, discount: Math.min(voucher.value, subtotal), error: null };
    if (shippingLeft <= 0) return fail('Delivery is already free on this order');
    return { ...base, shippingDiscount: shippingLeft, error: null };
  }

  async quote(db: Db, userId: string, input: QuoteInput) {
    const settings = await this.settings.get();
    const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
    const lines = await this.lines(db, userId, input);
    const errors: string[] = [];
    if (!lines.length) errors.push('Select at least one item to check out');
    for (const l of lines) if (l.issue) errors.push(`${l.title}: ${l.issue}`);

    const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
    const savings = lines.reduce((s, l) => s + (l.originalPrice - l.unitPrice) * l.quantity, 0);

    let address: Address | null = null;
    if (input.addressId) {
      address = await db.address.findFirst({ where: { id: input.addressId, userId } });
      if (!address) errors.push('Choose a delivery address');
    } else {
      address = await db.address.findFirst({ where: { userId }, orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }] });
    }
    if (!address && !errors.includes('Choose a delivery address')) errors.push('Add a delivery address');

    const zone: DeliveryZone | null = address ? zoneForDistrict(address.district) : null;
    const zoneRule = zone ? settings.delivery.zones[zone] : null;
    const shippingFee = zoneRule?.fee ?? 0;
    let shippingDiscount = subtotal >= settings.delivery.freeShippingThreshold ? shippingFee : 0;

    const code = input.voucherCode?.trim().toUpperCase();
    let voucher: VoucherResult | null = null;
    if (code) {
      const found = await db.voucher.findUnique({ where: { code } });
      voucher = found
        ? await this.checkVoucher(db, found, userId, subtotal, shippingFee - shippingDiscount)
        : { id: '', code, title: '', type: '', discount: 0, shippingDiscount: 0, error: 'Voucher code not found' };
    }
    const discount = voucher && !voucher.error ? voucher.discount : 0;
    if (voucher && !voucher.error) shippingDiscount += voucher.shippingDiscount;

    const coinCap = Math.floor(((subtotal - discount) * settings.coins.maxRedeemPercent) / 100);
    const usableCoins = Math.max(0, Math.min(user.coins, coinCap));
    const coinsUsed = input.useCoins ? usableCoins : 0;
    const total = Math.max(0, subtotal - discount + shippingFee - shippingDiscount - coinsUsed);

    const riskScore = address ? await this.riskScore(db, userId, address.phone, total) : 0;
    const cod = this.codDecision(settings, user.codBlocked, total, riskScore);

    return {
      lines,
      errors,
      address,
      delivery: zone ? { zone, label: ZONE_LABELS[zone], days: zoneRule!.days, fee: shippingFee } : null,
      subtotal,
      savings,
      shippingFee,
      shippingDiscount,
      discount,
      voucher,
      coins: { balance: user.coins, usable: usableCoins, used: coinsUsed, maxPercent: settings.coins.maxRedeemPercent },
      total,
      freeShippingThreshold: settings.delivery.freeShippingThreshold,
      payment: {
        codAllowed: cod.allowed,
        codReason: cod.reason,
        needsCall: cod.allowed && riskScore >= settings.cod.callThreshold,
        riskScore,
        methods: ['COD', 'BKASH', 'NAGAD', 'CARD'] as PaymentMethod[],
      },
      availableVouchers: await this.availableVouchers(db, userId, subtotal),
    };
  }

  private codDecision(settings: AppSettings, blocked: boolean, total: number, risk: number) {
    if (!settings.cod.enabled) return { allowed: false, reason: 'Cash on delivery is paused right now' };
    if (blocked) return { allowed: false, reason: 'Cash on delivery is not available for this account' };
    if (total > settings.cod.maxOrderTotal) return { allowed: false, reason: `Cash on delivery is available up to ৳${settings.cod.maxOrderTotal}` };
    if (risk >= settings.cod.advanceThreshold) {
      return { allowed: false, reason: 'Recent deliveries to this number failed, so please pay online for this order' };
    }
    return { allowed: true, reason: null };
  }

  /** Collected, currently valid vouchers with whether this cart qualifies. */
  private async availableVouchers(db: Db, userId: string, subtotal: number) {
    const now = new Date();
    const rows = await db.userVoucher.findMany({
      where: { userId, voucher: { isActive: true, startsAt: { lte: now }, endsAt: { gt: now } } },
      include: { voucher: true },
    });
    return rows.map(({ voucher: v }) => ({
      code: v.code,
      title: v.title,
      type: v.type,
      value: v.value,
      maxDiscount: v.maxDiscount,
      minSpend: v.minSpend,
      endsAt: v.endsAt,
      eligible: subtotal >= v.minSpend,
    }));
  }

  async place(userId: string, input: PlaceInput) {
    return this.prisma.$transaction(
      async (tx) => {
        const q = await this.quote(tx, userId, input);
        if (q.errors.length) throw new BadRequestException(q.errors[0]);
        if (input.voucherCode && q.voucher?.error) throw new BadRequestException(q.voucher.error);
        const address = q.address!;
        const settings = await this.settings.get();
        const prepaidByCredit = q.total === 0;
        const isCod = input.paymentMethod === 'COD' && !prepaidByCredit;
        if (isCod && !q.payment.codAllowed) throw new BadRequestException(q.payment.codReason ?? 'Cash on delivery is not available');

        // 1. Take stock. The conditional update is the only thing that can fail under a race.
        for (const line of q.lines) {
          const res = await tx.productVariant.updateMany({
            where: { id: line.variantId, stock: { gte: line.quantity } },
            data: { stock: { decrement: line.quantity } },
          });
          if (res.count !== 1) throw new ConflictException(`${line.title} just sold out. Update your cart and try again.`);
          if (line.flashSaleItemId && line.flashQuantityLimit != null) {
            const flash = await tx.flashSaleItem.updateMany({
              where: { id: line.flashSaleItemId, soldQty: { lte: line.flashQuantityLimit - line.quantity } },
              data: { soldQty: { increment: line.quantity } },
            });
            if (flash.count !== 1) throw new ConflictException(`The flash deal on ${line.title} just sold out.`);
          }
        }

        // 2. Claim the voucher.
        const voucherApplied = q.voucher && !q.voucher.error ? q.voucher : null;
        if (voucherApplied) {
          const v = await tx.voucher.findUniqueOrThrow({ where: { id: voucherApplied.id } });
          const res = await tx.voucher.updateMany({
            where: { id: v.id, ...(v.usageLimit != null ? { usedCount: { lt: v.usageLimit } } : {}) },
            data: { usedCount: { increment: 1 } },
          });
          if (res.count !== 1) throw new ConflictException('This voucher was just used up');
        }

        // 3. Create the order.
        const now = new Date();
        let status: OrderStatus;
        let paymentStatus: PaymentStatus = PaymentStatus.UNPAID;
        const events: Prisma.OrderEventCreateWithoutOrderInput[] = [];
        if (prepaidByCredit) {
          status = 'CONFIRMED';
          paymentStatus = PaymentStatus.PAID;
          events.push({ status: 'PLACED', title: 'Order placed', note: 'Paid in full with coins and vouchers', actor: 'customer' });
          events.push({ status: 'CONFIRMED', title: 'Order confirmed', note: 'Confirmed automatically', actor: 'system' });
        } else if (isCod) {
          if (q.payment.needsCall) {
            status = 'PLACED';
            events.push({ status: 'PLACED', title: 'Order placed', note: 'We will call you to confirm before packing', actor: 'customer' });
          } else {
            status = 'CONFIRMED';
            events.push({ status: 'PLACED', title: 'Order placed', note: 'Cash on delivery', actor: 'customer' });
            events.push({ status: 'CONFIRMED', title: 'Order confirmed', note: 'Confirmed automatically', actor: 'system' });
          }
        } else {
          status = 'AWAITING_PAYMENT';
          events.push({
            status: 'AWAITING_PAYMENT',
            title: 'Waiting for payment',
            note: `Complete payment within ${settings.orders.onlinePaymentExpiryMinutes} minutes`,
            actor: 'customer',
          });
        }

        const order = await tx.order.create({
          data: {
            orderNo: generateOrderNo(),
            userId,
            status,
            paymentMethod: input.paymentMethod,
            paymentStatus,
            subtotal: q.subtotal,
            shippingFee: q.shippingFee,
            shippingDiscount: q.shippingDiscount,
            discount: q.discount,
            coinsUsed: q.coins.used,
            total: q.total,
            voucherId: voucherApplied?.id ?? null,
            voucherCode: voucherApplied?.code ?? null,
            shipName: address.fullName,
            shipPhone: address.phone,
            shipDivision: address.division,
            shipDistrict: address.district,
            shipArea: address.area,
            shipLine: address.line,
            zone: q.delivery!.zone,
            note: input.note?.trim().slice(0, 300) || null,
            riskScore: q.payment.riskScore,
            needsCall: isCod && q.payment.needsCall,
            confirmedAt: status === 'CONFIRMED' ? now : null,
            expiresAt:
              status === 'AWAITING_PAYMENT'
                ? new Date(now.getTime() + settings.orders.onlinePaymentExpiryMinutes * 60 * 1000)
                : null,
            items: {
              create: q.lines.map((l) => ({
                productId: l.productId,
                variantId: l.variantId,
                title: l.title,
                variantLabel: l.variantLabel,
                imageUrl: l.image,
                unitPrice: l.unitPrice,
                originalPrice: l.originalPrice,
                quantity: l.quantity,
                lineTotal: l.lineTotal,
                flashSaleItemId: l.flashSaleItemId,
              })),
            },
            events: { create: events },
          },
        });

        await tx.inventoryMovement.createMany({
          data: q.lines.map((l) => ({
            variantId: l.variantId,
            delta: -l.quantity,
            reason: MovementReason.ORDER,
            refId: order.id,
            note: `Order ${order.orderNo}`,
          })),
        });
        if (voucherApplied) {
          await tx.voucherRedemption.create({
            data: {
              voucherId: voucherApplied.id,
              userId,
              orderId: order.id,
              discount: voucherApplied.discount + voucherApplied.shippingDiscount,
            },
          });
        }
        if (q.coins.used > 0) {
          await this.engagement.debit(tx, userId, q.coins.used, CoinReason.REDEEM, `Order ${order.orderNo}`, order.id);
        }
        if (isCod) {
          await tx.payment.create({
            data: {
              orderId: order.id,
              method: 'COD',
              provider: 'cod',
              amount: q.total,
              status: PaymentStatus.PENDING,
              idempotencyKey: `${order.id}:cod`,
            },
          });
        }
        if (!input.buyNow) {
          await tx.cartItem.deleteMany({
            where: { cart: { userId }, selected: true, variantId: { in: q.lines.map((l) => l.variantId) } },
          });
        }
        await this.engagement.notify(tx, userId, {
          type: 'order',
          title: status === 'AWAITING_PAYMENT' ? 'Complete your payment' : 'Order placed',
          body:
            status === 'AWAITING_PAYMENT'
              ? `Pay ৳${order.total} for order ${order.orderNo} to confirm it.`
              : `Thanks! Order ${order.orderNo} for ৳${order.total} is ${status === 'CONFIRMED' ? 'confirmed' : 'placed'}.`,
          link: `/account/orders/${order.orderNo}`,
        });

        return { orderNo: order.orderNo, status: order.status, total: order.total, next: status === 'AWAITING_PAYMENT' ? 'pay' : 'done' };
      },
      { timeout: 20000, maxWait: 10000 },
    );
  }
}
