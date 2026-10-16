import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AlertType } from '@prisma/client';
import { EngagementService } from '../common/engagement.service';
import { PricingService } from '../common/pricing.service';
import { SettingsService } from '../common/settings.service';
import { SmsService } from '../common/sms.service';
import { variantLabel } from '../common/utils';
import { PrismaService } from '../prisma/prisma.service';

const webUrl = (path: string) => `${(process.env.WEB_URL || 'http://localhost:3000').replace(/\/+$/, '')}${path}`;

@Injectable()
export class AlertsService {
  private readonly logger = new Logger('Alerts');
  private scanning = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: PricingService,
    private readonly settings: SettingsService,
    private readonly engagement: EngagementService,
    private readonly sms: SmsService,
  ) {}

  async subscribe(userId: string, variantId: string, type: AlertType) {
    const variant = await this.prisma.productVariant.findUnique({ where: { id: variantId }, include: { product: true } });
    if (!variant || !variant.isActive || variant.product.status !== 'ACTIVE') throw new NotFoundException('This item is not available');
    if (type === 'BACK_IN_STOCK' && variant.stock > 0) throw new BadRequestException('This item is in stock now, so you can order it straight away');
    const flash = (await this.pricing.activeFlash([variant.id])).get(variant.id);
    const price = this.pricing.price(variant, flash).unitPrice;
    // Re-subscribing re-arms an alert that already fired.
    return this.prisma.productAlert.upsert({
      where: { userId_variantId_type: { userId, variantId, type } },
      create: { userId, variantId, productId: variant.productId, type, priceAtSubscribe: price },
      update: { notifiedAt: null, priceAtSubscribe: price, createdAt: new Date() },
    });
  }

  async mine(userId: string) {
    const rows = await this.prisma.productAlert.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { variant: true, product: { include: { images: { orderBy: { sortOrder: 'asc' }, take: 1 } } } },
    });
    const flash = await this.pricing.activeFlash(rows.map((r) => r.variantId));
    return rows.map((r) => {
      const price = this.pricing.price(r.variant, flash.get(r.variantId)).unitPrice;
      return {
        id: r.id,
        type: r.type,
        createdAt: r.createdAt,
        notifiedAt: r.notifiedAt,
        priceAtSubscribe: r.priceAtSubscribe,
        currentPrice: price,
        inStock: r.variant.stock > 0 && r.variant.isActive,
        product: { slug: r.product.slug, title: r.product.title, image: r.variant.imageUrl ?? r.product.images[0]?.url ?? null },
        variantId: r.variantId,
        variantLabel: variantLabel(r.variant.options),
      };
    });
  }

  async remove(userId: string, id: string) {
    const res = await this.prisma.productAlert.deleteMany({ where: { id, userId } });
    if (!res.count) throw new NotFoundException('Alert not found');
    return { ok: true };
  }

  /**
   * Sends every alert whose condition now holds: the variant is back in stock, or its price
   * (flash price included) is below what the customer saw. Pass variant ids to check only those.
   */
  async scan(variantIds?: string[]) {
    // Full scans don't overlap; targeted scans (after a price or stock edit) always run.
    if (!variantIds) {
      if (this.scanning) return { sent: 0 };
      this.scanning = true;
    }
    try {
      const settings = await this.settings.get();
      const pending = await this.prisma.productAlert.findMany({
        where: {
          notifiedAt: null,
          ...(variantIds ? { variantId: { in: variantIds } } : {}),
          variant: { isActive: true, product: { status: 'ACTIVE' } },
        },
        include: { variant: true, product: { select: { title: true, slug: true } }, user: { select: { id: true, phone: true, isActive: true, marketingSms: true } } },
        take: 1000,
      });
      if (!pending.length) return { sent: 0 };
      const flash = await this.pricing.activeFlash([...new Set(pending.map((a) => a.variantId))]);
      let sent = 0;
      for (const a of pending) {
        if (!a.user.isActive) continue;
        const price = this.pricing.price(a.variant, flash.get(a.variantId)).unitPrice;
        const label = variantLabel(a.variant.options);
        const name = `${a.product.title}${label ? ` (${label})` : ''}`;
        const link = `/product/${a.product.slug}`;
        let title: string;
        let body: string;
        if (a.type === 'BACK_IN_STOCK') {
          if (a.variant.stock <= 0) continue;
          title = 'Back in stock';
          body = `${name} is back in stock at ৳${price}.`;
        } else {
          if (a.priceAtSubscribe == null || price >= a.priceAtSubscribe) continue;
          title = 'Price dropped';
          body = `${name} is now ৳${price} (was ৳${a.priceAtSubscribe}).`;
        }
        // Claim the alert first so two scans never notify twice.
        const claimed = await this.prisma.productAlert.updateMany({ where: { id: a.id, notifiedAt: null }, data: { notifiedAt: new Date() } });
        if (claimed.count !== 1) continue;
        await this.engagement.notify(this.prisma, a.userId, { type: 'alert', title, body, link });
        if (settings.alerts.smsEnabled && a.user.marketingSms) {
          await this.sms.send(a.user.phone, `${settings.store.name}: ${body} ${webUrl(link)}`, 'alert', a.userId);
        }
        sent++;
      }
      if (sent) this.logger.log(`Sent ${sent} stock/price alert(s)`);
      return { sent };
    } finally {
      if (!variantIds) this.scanning = false;
    }
  }

  /**
   * One SMS per stretch of cart activity: carts last touched between `abandonedCartHours` ago and
   * `abandonedCartMaxDays` ago, whose owner has not ordered since and opted in to SMS.
   */
  async cartReminders() {
    const settings = await this.settings.get();
    const { abandonedCartHours, abandonedCartMaxDays, smsEnabled } = settings.alerts;
    if (!abandonedCartHours) return { sent: 0 };
    const quietSince = new Date(Date.now() - abandonedCartHours * 3600_000);
    const notBefore = new Date(Date.now() - abandonedCartMaxDays * 86400_000);
    const carts = await this.prisma.$queryRaw<{ cartId: string; userId: string; phone: string; marketingSms: boolean; lines: number; last: Date }[]>`
      SELECT c.id AS "cartId", u.id AS "userId", u.phone, u."marketingSms", count(ci.id)::int AS lines, max(ci."updatedAt") AS last
      FROM "Cart" c
      JOIN "User" u ON u.id = c."userId"
      JOIN "CartItem" ci ON ci."cartId" = c.id
      WHERE u."isActive" AND u.role = 'CUSTOMER'
      GROUP BY c.id, u.id
      HAVING max(ci."updatedAt") < ${quietSince}
         AND max(ci."updatedAt") > ${notBefore}
         AND (c."remindedAt" IS NULL OR c."remindedAt" < max(ci."updatedAt"))
         AND NOT EXISTS (SELECT 1 FROM "Order" o WHERE o."userId" = u.id AND o."createdAt" > max(ci."updatedAt"))
      LIMIT 500`;
    let sent = 0;
    for (const c of carts) {
      const claimed = await this.prisma.cart.updateMany({
        where: { id: c.cartId, OR: [{ remindedAt: null }, { remindedAt: { lt: c.last } }] },
        data: { remindedAt: new Date() },
      });
      if (claimed.count !== 1) continue;
      const body = `You left ${c.lines} item${c.lines === 1 ? '' : 's'} in your cart. They're waiting for you.`;
      await this.engagement.notify(this.prisma, c.userId, { type: 'cart', title: 'Still thinking it over?', body, link: '/cart' });
      if (smsEnabled && c.marketingSms) await this.sms.send(c.phone, `${settings.store.name}: ${body} ${webUrl('/cart')}`, 'cart', c.userId);
      sent++;
    }
    if (sent) this.logger.log(`Sent ${sent} abandoned-cart reminder(s)`);
    return { sent };
  }

  /** Alerts waiting to fire, for the product page and admin. */
  async pendingFor(userId: string, variantIds: string[]) {
    return this.prisma.productAlert.findMany({
      where: { userId, variantId: { in: variantIds }, notifiedAt: null },
      select: { id: true, variantId: true, type: true },
    });
  }
}

