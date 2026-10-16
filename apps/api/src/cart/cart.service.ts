import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PricingService } from '../common/pricing.service';
import { SettingsService } from '../common/settings.service';
import { variantLabel } from '../common/utils';
import { PrismaService } from '../prisma/prisma.service';

export type CartIssue = 'OUT_OF_STOCK' | 'NOT_ENOUGH_STOCK' | 'UNAVAILABLE' | null;

@Injectable()
export class CartService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: PricingService,
    private readonly settings: SettingsService,
  ) {}

  async cartId(userId: string) {
    const cart = await this.prisma.cart.upsert({ where: { userId }, create: { userId }, update: {}, select: { id: true } });
    return cart.id;
  }

  async view(userId: string) {
    const cartId = await this.cartId(userId);
    const items = await this.prisma.cartItem.findMany({
      where: { cartId },
      orderBy: { addedAt: 'desc' },
      include: {
        variant: { include: { product: { include: { images: { orderBy: { sortOrder: 'asc' }, take: 1 }, brand: true } } } },
      },
    });
    const flashMap = await this.pricing.activeFlash(items.map((i) => i.variantId));
    const { orders } = await this.settings.get();

    const lines = items.map((item) => {
      const { variant } = item;
      const product = variant.product;
      const info = this.pricing.price(variant, flashMap.get(variant.id));
      let issue: CartIssue = null;
      if (!variant.isActive || product.status !== 'ACTIVE') issue = 'UNAVAILABLE';
      else if (variant.stock <= 0) issue = 'OUT_OF_STOCK';
      else if (variant.stock < item.quantity) issue = 'NOT_ENOUGH_STOCK';
      return {
        id: item.id,
        quantity: item.quantity,
        selected: item.selected,
        maxQty: Math.max(0, Math.min(variant.stock, orders.maxQtyPerItem)),
        issue,
        variant: { id: variant.id, sku: variant.sku, label: variantLabel(variant.options), stock: variant.stock },
        product: {
          id: product.id,
          slug: product.slug,
          title: product.title,
          brand: product.brand?.name ?? null,
          image: variant.imageUrl ?? product.images[0]?.url ?? null,
        },
        unitPrice: info.unitPrice,
        originalPrice: info.originalPrice,
        discountPct: info.discountPct,
        flash: !!info.flash,
        lineTotal: info.unitPrice * item.quantity,
      };
    });

    const buyable = lines.filter((l) => l.selected && !l.issue);
    return {
      items: lines,
      summary: {
        lines: lines.length,
        selectedLines: buyable.length,
        selectedQty: buyable.reduce((s, l) => s + l.quantity, 0),
        subtotal: buyable.reduce((s, l) => s + l.lineTotal, 0),
        savings: buyable.reduce((s, l) => s + (l.originalPrice - l.unitPrice) * l.quantity, 0),
      },
    };
  }

  async add(userId: string, variantId: string, quantity: number) {
    if (!Number.isInteger(quantity) || quantity < 1) throw new BadRequestException('Quantity must be at least 1');
    const variant = await this.prisma.productVariant.findUnique({ where: { id: variantId }, include: { product: true } });
    if (!variant || !variant.isActive || variant.product.status !== 'ACTIVE') throw new NotFoundException('This item is not available');
    const cartId = await this.cartId(userId);
    const existing = await this.prisma.cartItem.findUnique({ where: { cartId_variantId: { cartId, variantId } } });
    const next = (existing?.quantity ?? 0) + quantity;
    await this.assertQty(next, variant.stock);
    await this.prisma.cartItem.upsert({
      where: { cartId_variantId: { cartId, variantId } },
      create: { cartId, variantId, quantity: next },
      update: { quantity: next, selected: true },
    });
    return this.view(userId);
  }

  async update(userId: string, itemId: string, data: { quantity?: number; selected?: boolean }) {
    const item = await this.prisma.cartItem.findFirst({ where: { id: itemId, cart: { userId } }, include: { variant: true } });
    if (!item) throw new NotFoundException('Cart item not found');
    if (data.quantity != null) await this.assertQty(data.quantity, item.variant.stock);
    await this.prisma.cartItem.update({ where: { id: itemId }, data });
    return this.view(userId);
  }

  async remove(userId: string, itemIds: string[]) {
    await this.prisma.cartItem.deleteMany({ where: { id: { in: itemIds }, cart: { userId } } });
    return this.view(userId);
  }

  async selectAll(userId: string, selected: boolean) {
    await this.prisma.cartItem.updateMany({ where: { cart: { userId } }, data: { selected } });
    return this.view(userId);
  }

  private async assertQty(qty: number, stock: number) {
    const { orders } = await this.settings.get();
    if (!Number.isInteger(qty) || qty < 1) throw new BadRequestException('Quantity must be at least 1');
    if (qty > orders.maxQtyPerItem) throw new BadRequestException(`You can buy up to ${orders.maxQtyPerItem} of each item`);
    if (qty > stock) throw new BadRequestException(stock > 0 ? `Only ${stock} left in stock` : 'This item is out of stock');
  }
}
