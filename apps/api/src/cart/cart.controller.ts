import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { ArrayMaxSize, IsArray, IsBoolean, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { AuthUser, CurrentUser } from '../common/auth';
import { CARD_INCLUDE, PricingService } from '../common/pricing.service';
import { PrismaService } from '../prisma/prisma.service';
import { CartService } from './cart.service';

class AddItemDto {
  @IsString() variantId: string;
  @IsInt() @Min(1) @Max(100) quantity: number;
}

class UpdateItemDto {
  @IsOptional() @IsInt() @Min(1) @Max(100) quantity?: number;
  @IsOptional() @IsBoolean() selected?: boolean;
}

class SelectAllDto {
  @IsBoolean() selected: boolean;
}

class RemoveDto {
  @IsArray() @ArrayMaxSize(100) @IsString({ each: true }) ids: string[];
}

class ProductIdDto {
  @IsString() productId: string;
}

@Controller()
export class CartController {
  constructor(
    private readonly cart: CartService,
    private readonly prisma: PrismaService,
    private readonly pricing: PricingService,
  ) {}

  @Get('cart')
  view(@CurrentUser() user: AuthUser) {
    return this.cart.view(user.id);
  }

  @Post('cart/items')
  add(@CurrentUser() user: AuthUser, @Body() dto: AddItemDto) {
    return this.cart.add(user.id, dto.variantId, dto.quantity);
  }

  @Patch('cart/items/:id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateItemDto) {
    return this.cart.update(user.id, id, dto);
  }

  @Delete('cart/items/:id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.cart.remove(user.id, [id]);
  }

  @HttpCode(200)
  @Post('cart/remove')
  removeMany(@CurrentUser() user: AuthUser, @Body() dto: RemoveDto) {
    return this.cart.remove(user.id, dto.ids);
  }

  @HttpCode(200)
  @Post('cart/select-all')
  selectAll(@CurrentUser() user: AuthUser, @Body() dto: SelectAllDto) {
    return this.cart.selectAll(user.id, dto.selected);
  }

  /** Move a cart line to the wishlist. */
  @HttpCode(200)
  @Post('cart/items/:id/save-for-later')
  async saveForLater(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const item = await this.prisma.cartItem.findFirst({ where: { id, cart: { userId: user.id } }, include: { variant: true } });
    if (item) {
      await this.prisma.wishlistItem.upsert({
        where: { userId_productId: { userId: user.id, productId: item.variant.productId } },
        create: { userId: user.id, productId: item.variant.productId },
        update: {},
      });
    }
    return this.cart.remove(user.id, [id]);
  }

  @Get('wishlist')
  async wishlist(@CurrentUser() user: AuthUser) {
    const rows = await this.prisma.wishlistItem.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      include: { product: { include: CARD_INCLUDE } },
    });
    const cards = await this.pricing.cards(rows.map((r) => r.product));
    return { items: cards.map((card, i) => ({ ...card, available: rows[i].product.status === 'ACTIVE' })) };
  }

  @Post('wishlist')
  async addWishlist(@CurrentUser() user: AuthUser, @Body() dto: ProductIdDto) {
    await this.prisma.wishlistItem.upsert({
      where: { userId_productId: { userId: user.id, productId: dto.productId } },
      create: { userId: user.id, productId: dto.productId },
      update: {},
    });
    return { wishlisted: true };
  }

  @Delete('wishlist/:productId')
  async removeWishlist(@CurrentUser() user: AuthUser, @Param('productId') productId: string) {
    await this.prisma.wishlistItem.deleteMany({ where: { userId: user.id, productId } });
    return { wishlisted: false };
  }
}
