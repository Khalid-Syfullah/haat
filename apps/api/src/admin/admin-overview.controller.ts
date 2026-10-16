import { Body, Controller, Get, NotFoundException, Param, Patch, Put, Query } from '@nestjs/common';
import { Prisma, ReviewStatus, Role } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ReviewsService } from '../aftersale/reviews.service';
import { Roles } from '../common/auth';
import { EngagementService } from '../common/engagement.service';
import { SettingsService } from '../common/settings.service';
import { clamp, dhakaDay, dhakaDayStart, toBool, toInt, variantLabel } from '../common/utils';
import { PrismaService } from '../prisma/prisma.service';

class ReviewUpdateDto {
  @IsOptional() @IsEnum(ReviewStatus) status?: ReviewStatus;
  @IsOptional() @IsString() @MaxLength(1000) reply?: string | null;
}

class QuestionUpdateDto {
  @IsOptional() @IsString() @MaxLength(1000) answer?: string | null;
  @IsOptional() @IsBoolean() isPublished?: boolean;
}

class CustomerUpdateDto {
  @IsOptional() @IsBoolean() codBlocked?: boolean;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

const COUNTED: Prisma.OrderWhereInput = { status: { notIn: ['CANCELLED', 'DELIVERY_FAILED', 'AWAITING_PAYMENT'] } };

@Roles(Role.ADMIN)
@Controller('admin')
export class AdminOverviewController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly reviews: ReviewsService,
    private readonly engagement: EngagementService,
  ) {}

  @Get('dashboard')
  async dashboard() {
    const today = dhakaDayStart();
    const since = new Date(today.getTime() - 29 * 86400000);
    const [todayAgg, monthAgg, toCall, toPack, toShip, inTransit, returns, refunds, unanswered, recent, series, lowStock] = await Promise.all([
      this.prisma.order.aggregate({ where: { ...COUNTED, createdAt: { gte: today } }, _sum: { total: true }, _count: { _all: true } }),
      this.prisma.order.aggregate({ where: { ...COUNTED, createdAt: { gte: since } }, _sum: { total: true }, _count: { _all: true } }),
      this.prisma.order.count({ where: { status: 'PLACED' } }),
      this.prisma.order.count({ where: { status: 'CONFIRMED' } }),
      this.prisma.order.count({ where: { status: 'PACKED' } }),
      this.prisma.order.count({ where: { status: 'SHIPPED' } }),
      this.prisma.returnRequest.count({ where: { status: { in: ['REQUESTED', 'RECEIVED'] } } }),
      this.prisma.order.count({ where: { paymentStatus: 'REFUND_PENDING' } }),
      this.prisma.question.count({ where: { answer: null } }),
      this.prisma.order.findMany({ orderBy: { createdAt: 'desc' }, take: 8 }),
      this.prisma.$queryRaw<{ day: string; orders: number; revenue: number }[]>`
        SELECT to_char(("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Dhaka', 'YYYY-MM-DD') AS day,
               count(*)::int AS orders, coalesce(sum(total), 0)::int AS revenue
        FROM "Order"
        WHERE "createdAt" >= ${since} AND status NOT IN ('CANCELLED', 'DELIVERY_FAILED', 'AWAITING_PAYMENT')
        GROUP BY 1 ORDER BY 1`,
      this.prisma.$queryRaw<{ id: string; sku: string; options: unknown; stock: number; lowStockThreshold: number; title: string; productId: string }[]>`
        SELECT v.id, v.sku, v.options, v.stock, v."lowStockThreshold", p.title, p.id AS "productId"
        FROM "ProductVariant" v JOIN "Product" p ON p.id = v."productId"
        WHERE v."isActive" AND p.status = 'ACTIVE' AND v.stock <= v."lowStockThreshold"
        ORDER BY v.stock ASC LIMIT 10`,
    ]);

    // Fill missing days so the chart has 30 points.
    const byDay = new Map(series.map((r) => [r.day, r]));
    const days = Array.from({ length: 30 }, (_, i) => {
      const day = dhakaDay(new Date(since.getTime() + i * 86400000 + 6 * 3600000));
      const row = byDay.get(day);
      return { day, orders: row?.orders ?? 0, revenue: row?.revenue ?? 0 };
    });

    return {
      today: { orders: todayAgg._count._all, revenue: todayAgg._sum.total ?? 0 },
      last30: { orders: monthAgg._count._all, revenue: monthAgg._sum.total ?? 0, days },
      queues: { toCall, toPack, toShip, inTransit, returns, refunds, unanswered },
      lowStock: lowStock.map((v) => ({ ...v, label: variantLabel(v.options) })),
      recentOrders: recent.map((o) => ({
        id: o.id,
        orderNo: o.orderNo,
        status: o.status,
        total: o.total,
        customer: o.shipName,
        paymentMethod: o.paymentMethod,
        createdAt: o.createdAt,
      })),
    };
  }

  // ───── Customers ─────

  @Get('customers')
  async customers(@Query() query: Record<string, string>) {
    const page = clamp(toInt(query.page, 1), 1, 1000);
    const where: Prisma.UserWhereInput = { role: 'CUSTOMER' };
    if (query.q) {
      where.OR = [
        { name: { contains: query.q, mode: 'insensitive' } },
        { phone: { contains: query.q } },
        { email: { contains: query.q, mode: 'insensitive' } },
      ];
    }
    if (toBool(query.codBlocked)) where.codBlocked = true;
    const [users, total] = await Promise.all([
      this.prisma.user.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * 20, take: 20 }),
      this.prisma.user.count({ where }),
    ]);
    const stats = users.length
      ? await this.prisma.order.groupBy({
          by: ['userId', 'status'],
          where: { userId: { in: users.map((u) => u.id) } },
          _count: { _all: true },
          _sum: { total: true },
        })
      : [];
    return {
      items: users.map((u) => {
        const mine = stats.filter((s) => s.userId === u.id);
        const count = (status: string) => mine.find((s) => s.status === status)?._count._all ?? 0;
        return {
          id: u.id,
          name: u.name,
          phone: u.phone,
          email: u.email,
          coins: u.coins,
          codBlocked: u.codBlocked,
          isActive: u.isActive,
          createdAt: u.createdAt,
          orders: mine.reduce((s, m) => s + m._count._all, 0),
          delivered: count('DELIVERED'),
          failed: count('DELIVERY_FAILED'),
          cancelled: count('CANCELLED'),
          spent: mine.filter((m) => m.status === 'DELIVERED').reduce((s, m) => s + (m._sum.total ?? 0), 0),
        };
      }),
      total,
      page,
      pages: Math.max(1, Math.ceil(total / 20)),
    };
  }

  @Patch('customers/:id')
  async updateCustomer(@Param('id') id: string, @Body() dto: CustomerUpdateDto) {
    const user = await this.prisma.user.findFirst({ where: { id, role: 'CUSTOMER' } });
    if (!user) throw new NotFoundException('Customer not found');
    return this.prisma.user.update({
      where: { id },
      data: dto,
      select: { id: true, codBlocked: true, isActive: true },
    });
  }

  // ───── Reviews ─────

  @Get('reviews')
  async allReviews(@Query() query: Record<string, string>) {
    const page = clamp(toInt(query.page, 1), 1, 1000);
    const where: Prisma.ReviewWhereInput = {};
    if (query.status && query.status in ReviewStatus) where.status = query.status as ReviewStatus;
    if (toBool(query.unreplied)) where.reply = null;
    const rating = toInt(query.rating, 0);
    if (rating >= 1 && rating <= 5) where.rating = rating;
    const [items, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * 20,
        take: 20,
        include: { user: { select: { name: true, phone: true } }, product: { select: { title: true, slug: true } } },
      }),
      this.prisma.review.count({ where }),
    ]);
    return { items, total, page, pages: Math.max(1, Math.ceil(total / 20)) };
  }

  @Patch('reviews/:id')
  async updateReview(@Param('id') id: string, @Body() dto: ReviewUpdateDto) {
    return this.prisma.$transaction(async (tx) => {
      const review = await tx.review.findUnique({ where: { id } });
      if (!review) throw new NotFoundException('Review not found');
      const replyChanged = dto.reply !== undefined && dto.reply !== review.reply;
      const updated = await tx.review.update({
        where: { id },
        data: {
          status: dto.status,
          reply: dto.reply === undefined ? undefined : dto.reply?.trim() || null,
          repliedAt: replyChanged ? (dto.reply ? new Date() : null) : undefined,
        },
      });
      if (dto.status && dto.status !== review.status) await this.reviews.refreshRating(tx, review.productId);
      if (replyChanged && dto.reply) {
        const product = await tx.product.findUniqueOrThrow({ where: { id: review.productId }, select: { slug: true, title: true } });
        await this.engagement.notify(tx, review.userId, {
          type: 'review',
          title: 'The store replied to your review',
          body: product.title,
          link: `/product/${product.slug}#reviews`,
        });
      }
      return updated;
    });
  }

  // ───── Questions ─────

  @Get('questions')
  async allQuestions(@Query() query: Record<string, string>) {
    const page = clamp(toInt(query.page, 1), 1, 1000);
    const where: Prisma.QuestionWhereInput = toBool(query.unanswered) ? { answer: null } : {};
    const [items, total] = await Promise.all([
      this.prisma.question.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * 20,
        take: 20,
        include: { user: { select: { name: true } }, product: { select: { title: true, slug: true } } },
      }),
      this.prisma.question.count({ where }),
    ]);
    return { items, total, page, pages: Math.max(1, Math.ceil(total / 20)) };
  }

  @Patch('questions/:id')
  async answer(@Param('id') id: string, @Body() dto: QuestionUpdateDto) {
    return this.prisma.$transaction(async (tx) => {
      const q = await tx.question.findUnique({ where: { id }, include: { product: { select: { slug: true, title: true } } } });
      if (!q) throw new NotFoundException('Question not found');
      const answer = dto.answer === undefined ? undefined : dto.answer?.trim() || null;
      const updated = await tx.question.update({
        where: { id },
        data: { answer, answeredAt: answer === undefined ? undefined : answer ? new Date() : null, isPublished: dto.isPublished },
      });
      if (answer && !q.answer) {
        await this.engagement.notify(tx, q.userId, {
          type: 'question',
          title: 'Your question was answered',
          body: q.product.title,
          link: `/product/${q.product.slug}#questions`,
        });
      }
      return updated;
    });
  }

  // ───── Settings ─────

  @Get('settings')
  getSettings() {
    return this.settings.get();
  }

  @Put('settings')
  updateSettings(@Body() body: Record<string, unknown>) {
    return this.settings.update(body);
  }
}
