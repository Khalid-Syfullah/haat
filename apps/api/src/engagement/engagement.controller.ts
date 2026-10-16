import { BadRequestException, Controller, Get, HttpCode, NotFoundException, Param, Post } from '@nestjs/common';
import { CoinReason } from '@prisma/client';
import { AuthUser, CurrentUser, Public } from '../common/auth';
import { EngagementService } from '../common/engagement.service';
import { SettingsService } from '../common/settings.service';
import { dhakaDayStart } from '../common/utils';
import { PrismaService } from '../prisma/prisma.service';

@Controller()
export class EngagementController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly engagement: EngagementService,
    private readonly settings: SettingsService,
  ) {}

  // ───── Coins ─────

  @Get('coins')
  async coins(@CurrentUser() auth: AuthUser) {
    const [user, txns, settings] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({ where: { id: auth.id } }),
      this.prisma.coinTransaction.findMany({ where: { userId: auth.id }, orderBy: { createdAt: 'desc' }, take: 50 }),
      this.settings.get(),
    ]);
    const today = dhakaDayStart();
    return {
      balance: user.coins,
      canCheckIn: !user.lastCheckInAt || user.lastCheckInAt < today,
      rules: settings.coins,
      transactions: txns,
    };
  }

  @HttpCode(200)
  @Post('coins/check-in')
  async checkIn(@CurrentUser() auth: AuthUser) {
    const { coins } = await this.settings.get();
    const today = dhakaDayStart();
    return this.prisma.$transaction(async (tx) => {
      const res = await tx.user.updateMany({
        where: { id: auth.id, OR: [{ lastCheckInAt: null }, { lastCheckInAt: { lt: today } }] },
        data: { lastCheckInAt: new Date() },
      });
      if (res.count !== 1) throw new BadRequestException('You have already checked in today. Come back tomorrow!');
      await this.engagement.credit(tx, auth.id, coins.checkInReward, CoinReason.CHECK_IN, 'Daily check-in');
      const user = await tx.user.findUniqueOrThrow({ where: { id: auth.id } });
      return { earned: coins.checkInReward, balance: user.coins };
    });
  }

  // ───── Notifications ─────

  @Get('notifications')
  async notifications(@CurrentUser() auth: AuthUser) {
    const [items, unread] = await Promise.all([
      this.prisma.notification.findMany({ where: { userId: auth.id }, orderBy: { createdAt: 'desc' }, take: 50 }),
      this.prisma.notification.count({ where: { userId: auth.id, readAt: null } }),
    ]);
    return { items, unread };
  }

  @HttpCode(200)
  @Post('notifications/read-all')
  async readAll(@CurrentUser() auth: AuthUser) {
    await this.prisma.notification.updateMany({ where: { userId: auth.id, readAt: null }, data: { readAt: new Date() } });
    return { ok: true };
  }

  @HttpCode(200)
  @Post('notifications/:id/read')
  async read(@CurrentUser() auth: AuthUser, @Param('id') id: string) {
    await this.prisma.notification.updateMany({ where: { id, userId: auth.id, readAt: null }, data: { readAt: new Date() } });
    return { ok: true };
  }

  // ───── Vouchers ─────

  @Public()
  @Get('vouchers/collectible')
  async collectible(@CurrentUser() auth?: AuthUser) {
    const now = new Date();
    const vouchers = await this.prisma.voucher.findMany({
      where: { isActive: true, isCollectible: true, startsAt: { lte: now }, endsAt: { gt: now } },
      orderBy: { minSpend: 'asc' },
    });
    const collected = auth
      ? new Set((await this.prisma.userVoucher.findMany({ where: { userId: auth.id }, select: { voucherId: true } })).map((v) => v.voucherId))
      : new Set<string>();
    return vouchers.map((v) => ({
      id: v.id,
      code: v.code,
      title: v.title,
      description: v.description,
      type: v.type,
      value: v.value,
      maxDiscount: v.maxDiscount,
      minSpend: v.minSpend,
      endsAt: v.endsAt,
      fullyUsed: v.usageLimit != null && v.usedCount >= v.usageLimit,
      collected: collected.has(v.id),
    }));
  }

  @HttpCode(200)
  @Post('vouchers/:id/collect')
  async collect(@CurrentUser() auth: AuthUser, @Param('id') id: string) {
    const now = new Date();
    const voucher = await this.prisma.voucher.findFirst({
      where: { id, isActive: true, isCollectible: true, startsAt: { lte: now }, endsAt: { gt: now } },
    });
    if (!voucher) throw new NotFoundException('This voucher is no longer available');
    await this.prisma.userVoucher.upsert({
      where: { userId_voucherId: { userId: auth.id, voucherId: id } },
      create: { userId: auth.id, voucherId: id },
      update: {},
    });
    return { collected: true, code: voucher.code };
  }

  @Get('vouchers/mine')
  async mine(@CurrentUser() auth: AuthUser) {
    const rows = await this.prisma.userVoucher.findMany({
      where: { userId: auth.id },
      include: { voucher: { include: { redemptions: { where: { userId: auth.id, reversedAt: null }, select: { id: true } } } } },
      orderBy: { collectedAt: 'desc' },
    });
    const now = new Date();
    return rows.map(({ voucher: v }) => {
      const used = v.redemptions.length >= v.perUserLimit;
      const expired = v.endsAt <= now;
      return {
        id: v.id,
        code: v.code,
        title: v.title,
        description: v.description,
        type: v.type,
        value: v.value,
        maxDiscount: v.maxDiscount,
        minSpend: v.minSpend,
        endsAt: v.endsAt,
        state: used ? 'used' : expired || !v.isActive ? 'expired' : 'available',
      };
    });
  }
}
