import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { PaymentMethod } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { AuthUser, CurrentUser } from '../common/auth';
import { PrismaService } from '../prisma/prisma.service';
import { CheckoutService } from './checkout.service';

class BuyNowDto {
  @IsString() variantId: string;
  @IsInt() @Min(1) @Max(100) quantity: number;
}

class QuoteDto {
  @IsOptional() @IsString() addressId?: string;
  @IsOptional() @IsString() @MaxLength(40) voucherCode?: string;
  @IsOptional() @IsBoolean() useCoins?: boolean;
  @IsOptional() @IsEnum(PaymentMethod) paymentMethod?: PaymentMethod;
  @IsOptional() @ValidateNested() @Type(() => BuyNowDto) buyNow?: BuyNowDto;
}

class PlaceDto {
  @IsString() addressId: string;
  @IsEnum(PaymentMethod) paymentMethod: PaymentMethod;
  @IsOptional() @IsString() @MaxLength(40) voucherCode?: string;
  @IsOptional() @IsBoolean() useCoins?: boolean;
  @IsOptional() @ValidateNested() @Type(() => BuyNowDto) buyNow?: BuyNowDto;
  @IsOptional() @IsString() @MaxLength(300) note?: string;
}

@Controller('checkout')
export class CheckoutController {
  constructor(
    private readonly checkout: CheckoutService,
    private readonly prisma: PrismaService,
  ) {}

  @HttpCode(200)
  @Post('quote')
  quote(@CurrentUser() user: AuthUser, @Body() dto: QuoteDto) {
    return this.checkout.quote(this.prisma, user.id, dto);
  }

  @Post('place')
  place(@CurrentUser() user: AuthUser, @Body() dto: PlaceDto) {
    return this.checkout.place(user.id, dto);
  }
}
