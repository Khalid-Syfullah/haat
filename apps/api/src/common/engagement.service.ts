import { BadRequestException, Injectable } from '@nestjs/common';
import { CoinReason } from '@prisma/client';
import { Db, PrismaService } from '../prisma/prisma.service';

export interface NotifyInput {
  type: string;
  title: string;
  body: string;
  link?: string;
}

/** Coins ledger and in-app notifications. Both accept a transaction client. */
@Injectable()
export class EngagementService {
  constructor(private readonly prisma: PrismaService) {}

  async credit(db: Db, userId: string, amount: number, reason: CoinReason, note?: string, refId?: string) {
    if (amount <= 0) return;
    await db.user.update({ where: { id: userId }, data: { coins: { increment: amount } } });
    await db.coinTransaction.create({ data: { userId, amount, reason, note, refId } });
  }

  async debit(db: Db, userId: string, amount: number, reason: CoinReason, note?: string, refId?: string) {
    if (amount <= 0) return;
    const res = await db.user.updateMany({
      where: { id: userId, coins: { gte: amount } },
      data: { coins: { decrement: amount } },
    });
    if (res.count !== 1) throw new BadRequestException('Not enough coins');
    await db.coinTransaction.create({ data: { userId, amount: -amount, reason, note, refId } });
  }

  async notify(db: Db, userId: string, input: NotifyInput) {
    await db.notification.create({ data: { userId, ...input } });
  }
}
