import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Post, Query } from '@nestjs/common';
import { CoinReason, Prisma } from '@prisma/client';
import { ArrayMaxSize, IsArray, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { AuthUser, CurrentUser, Public } from '../common/auth';
import { EngagementService } from '../common/engagement.service';
import { SettingsService } from '../common/settings.service';
import { clamp, maskName, toBool, toInt } from '../common/utils';
import { PrismaService } from '../prisma/prisma.service';
import { ReviewsService } from './reviews.service';

class ReviewDto {
  @IsString() orderItemId: string;
  @IsInt() @Min(1) @Max(5) rating: number;
  @IsOptional() @IsString() @MaxLength(1000) comment?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(5) @IsString({ each: true }) images?: string[];
}

class QuestionDto {
  @IsString() @MinLength(5) @MaxLength(300) question: string;
}

class ReturnDto {
  @IsString() orderItemId: string;
  @IsInt() @Min(1) quantity: number;
  @IsString() @MaxLength(80) reason: string;
  @IsOptional() @IsString() @MaxLength(1000) details?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(5) @IsString({ each: true }) images?: string[];
}

const onlyUploads = (images?: string[]) => (images ?? []).filter((url) => url.startsWith('/uploads/'));

@Controller()
export class AftersaleController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reviews: ReviewsService,
    private readonly engagement: EngagementService,
    private readonly settings: SettingsService,
  ) {}

  // ───── Reviews ─────

  @Public()
  @Get('products/:slug/reviews')
  async productReviews(@Param('slug') slug: string, @Query() query: Record<string, string>) {
    const product = await this.prisma.product.findUnique({ where: { slug }, select: { id: true, ratingAvg: true, ratingCount: true } });
    if (!product) throw new NotFoundException('Product not found');
    const page = clamp(toInt(query.page, 1), 1, 200);
    const rating = toInt(query.rating, 0);
    const where: Prisma.ReviewWhereInput = { productId: product.id, status: 'PUBLISHED' };
    if (rating >= 1 && rating <= 5) where.rating = rating;
    if (toBool(query.withPhotos)) where.images = { isEmpty: false };

    const [rows, total, stars, withPhotos] = await Promise.all([
      this.prisma.review.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * 10,
        take: 10,
        include: { user: { select: { name: true } }, orderItem: { select: { variantLabel: true } } },
      }),
      this.prisma.review.count({ where }),
      this.prisma.review.groupBy({ by: ['rating'], where: { productId: product.id, status: 'PUBLISHED' }, _count: { _all: true } }),
      this.prisma.review.count({ where: { productId: product.id, status: 'PUBLISHED', images: { isEmpty: false } } }),
    ]);
    const breakdown: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    for (const s of stars) breakdown[s.rating] = s._count._all;
    return {
      summary: { avg: Math.round(product.ratingAvg * 10) / 10, count: product.ratingCount, breakdown, withPhotos },
      items: rows.map((r) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        images: r.images,
        reply: r.reply,
        repliedAt: r.repliedAt,
        createdAt: r.createdAt,
        author: maskName(r.user.name),
        variantLabel: r.orderItem.variantLabel,
      })),
      total,
      page,
      pages: Math.max(1, Math.ceil(total / 10)),
    };
  }

  @Get('reviews/mine')
  async myReviews(@CurrentUser() user: AuthUser) {
    const [pending, written] = await Promise.all([
      this.prisma.orderItem.findMany({
        where: { reviewed: false, order: { userId: user.id, status: 'DELIVERED' } },
        include: { order: { select: { orderNo: true, deliveredAt: true } } },
        orderBy: { order: { deliveredAt: 'desc' } },
      }),
      this.prisma.review.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        include: { product: { select: { title: true, slug: true } }, orderItem: { select: { imageUrl: true, variantLabel: true } } },
      }),
    ]);
    const { coins } = await this.settings.get();
    return {
      reviewReward: coins.reviewReward,
      pending: pending.map((i) => ({
        orderItemId: i.id,
        orderNo: i.order.orderNo,
        deliveredAt: i.order.deliveredAt,
        title: i.title,
        variantLabel: i.variantLabel,
        imageUrl: i.imageUrl,
      })),
      written: written.map((r) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        images: r.images,
        reply: r.reply,
        status: r.status,
        createdAt: r.createdAt,
        product: r.product,
        imageUrl: r.orderItem.imageUrl,
        variantLabel: r.orderItem.variantLabel,
      })),
    };
  }

  @Post('reviews')
  async createReview(@CurrentUser() user: AuthUser, @Body() dto: ReviewDto) {
    const item = await this.prisma.orderItem.findFirst({
      where: { id: dto.orderItemId, order: { userId: user.id } },
      include: { order: true },
    });
    if (!item) throw new NotFoundException('Order item not found');
    if (item.order.status !== 'DELIVERED') throw new BadRequestException('You can review an item after it is delivered');
    if (item.reviewed) throw new BadRequestException('You have already reviewed this item');
    const { coins } = await this.settings.get();
    return this.prisma.$transaction(async (tx) => {
      const marked = await tx.orderItem.updateMany({ where: { id: item.id, reviewed: false }, data: { reviewed: true } });
      if (marked.count !== 1) throw new BadRequestException('You have already reviewed this item');
      const review = await tx.review.create({
        data: {
          productId: item.productId,
          userId: user.id,
          orderItemId: item.id,
          rating: dto.rating,
          comment: dto.comment?.trim() ?? '',
          images: onlyUploads(dto.images),
        },
      });
      await this.reviews.refreshRating(tx, item.productId);
      await this.engagement.credit(tx, user.id, coins.reviewReward, CoinReason.REVIEW_REWARD, `Review of ${item.title}`, review.id);
      return { review, coinsEarned: coins.reviewReward };
    });
  }

  // ───── Questions ─────

  @Public()
  @Get('products/:slug/questions')
  async questions(@Param('slug') slug: string, @Query('page') pageQ?: string) {
    const product = await this.prisma.product.findUnique({ where: { slug }, select: { id: true } });
    if (!product) throw new NotFoundException('Product not found');
    const page = clamp(toInt(pageQ, 1), 1, 200);
    const where = { productId: product.id, isPublished: true };
    const [rows, total] = await Promise.all([
      this.prisma.question.findMany({
        where,
        orderBy: [{ answeredAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
        skip: (page - 1) * 10,
        take: 10,
        include: { user: { select: { name: true } } },
      }),
      this.prisma.question.count({ where }),
    ]);
    return {
      items: rows.map((q) => ({
        id: q.id,
        question: q.question,
        answer: q.answer,
        answeredAt: q.answeredAt,
        createdAt: q.createdAt,
        author: maskName(q.user.name),
      })),
      total,
      page,
      pages: Math.max(1, Math.ceil(total / 10)),
    };
  }

  @Post('products/:slug/questions')
  async ask(@CurrentUser() user: AuthUser, @Param('slug') slug: string, @Body() dto: QuestionDto) {
    const product = await this.prisma.product.findUnique({ where: { slug }, select: { id: true } });
    if (!product) throw new NotFoundException('Product not found');
    const recent = await this.prisma.question.count({ where: { userId: user.id, createdAt: { gt: new Date(Date.now() - 3600_000) } } });
    if (recent >= 10) throw new BadRequestException('You have asked a lot of questions in the last hour. Try again later.');
    const q = await this.prisma.question.create({ data: { productId: product.id, userId: user.id, question: dto.question.trim() } });
    return { id: q.id, question: q.question, createdAt: q.createdAt };
  }

  // ───── Returns ─────

  @Get('returns')
  async myReturns(@CurrentUser() user: AuthUser) {
    const rows = await this.prisma.returnRequest.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      include: { orderItem: true, order: { select: { orderNo: true } } },
    });
    return rows.map((r) => ({
      id: r.id,
      orderNo: r.order.orderNo,
      status: r.status,
      quantity: r.quantity,
      reason: r.reason,
      details: r.details,
      images: r.images,
      refundAmount: r.refundAmount,
      refundMethod: r.refundMethod,
      adminNote: r.adminNote,
      createdAt: r.createdAt,
      resolvedAt: r.resolvedAt,
      item: { title: r.orderItem.title, variantLabel: r.orderItem.variantLabel, imageUrl: r.orderItem.imageUrl, unitPrice: r.orderItem.unitPrice },
    }));
  }

  @Post('returns')
  async requestReturn(@CurrentUser() user: AuthUser, @Body() dto: ReturnDto) {
    const item = await this.prisma.orderItem.findFirst({
      where: { id: dto.orderItemId, order: { userId: user.id } },
      include: { order: true, returns: true, variant: { select: { product: { select: { returnDays: true } } } } },
    });
    if (!item) throw new NotFoundException('Order item not found');
    if (item.order.status !== 'DELIVERED' || !item.order.deliveredAt) throw new BadRequestException('Returns open after delivery');
    const days = item.variant.product.returnDays;
    if (days <= 0) throw new BadRequestException('This item cannot be returned once opened, for hygiene reasons');
    if (Date.now() > item.order.deliveredAt.getTime() + days * 86400000) {
      throw new BadRequestException(`The ${days}-day return window for this item has closed`);
    }
    const already = item.returns.filter((r) => r.status !== 'REJECTED').reduce((s, r) => s + r.quantity, 0);
    if (dto.quantity > item.quantity - already) throw new BadRequestException(`You can return up to ${item.quantity - already} of this item`);
    if (item.returns.some((r) => r.status === 'REQUESTED' || r.status === 'APPROVED')) {
      throw new BadRequestException('There is already an open return for this item');
    }
    return this.prisma.$transaction(async (tx) => {
      const ret = await tx.returnRequest.create({
        data: {
          orderId: item.orderId,
          orderItemId: item.id,
          userId: user.id,
          quantity: dto.quantity,
          reason: dto.reason,
          details: dto.details?.trim() || null,
          images: onlyUploads(dto.images),
          refundAmount: item.unitPrice * dto.quantity,
        },
      });
      await tx.orderEvent.create({
        data: { orderId: item.orderId, title: 'Return requested', note: `${dto.quantity} × ${item.title}: ${dto.reason}`, actor: 'customer' },
      });
      await this.engagement.notify(tx, user.id, {
        type: 'return',
        title: 'Return request received',
        body: `We'll review your return for ${item.title} within 2 working days.`,
        link: '/account/returns',
      });
      return ret;
    });
  }
}
