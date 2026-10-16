import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Every business rule that staff may want to change lives here.
 * The `app` row in the Setting table is deep-merged over these defaults.
 */
export const DEFAULT_SETTINGS = {
  store: {
    name: 'Haat',
    tagline: 'Everything you need, delivered across Bangladesh',
    supportPhone: '09600-000000',
    supportEmail: 'support@haat.example',
  },
  delivery: {
    zones: {
      INSIDE_DHAKA: { fee: 60, days: '1-2' },
      DHAKA_SUBURBS: { fee: 100, days: '2-3' },
      OUTSIDE_DHAKA: { fee: 120, days: '3-5' },
    },
    freeShippingThreshold: 2000,
  },
  cod: {
    enabled: true,
    maxOrderTotal: 50000,
    /** At or above this risk score the order waits for a confirmation call. */
    callThreshold: 40,
    /** At or above this risk score COD is not offered. */
    advanceThreshold: 70,
  },
  coins: {
    checkInReward: 5,
    orderRewardPercent: 1,
    reviewReward: 10,
    /** Coins may pay at most this share of (subtotal - voucher discount). */
    maxRedeemPercent: 10,
  },
  orders: {
    onlinePaymentExpiryMinutes: 30,
    maxQtyPerItem: 10,
  },
  alerts: {
    /** Text customers about price drops, restocks and abandoned carts (in-app notices are always sent). */
    smsEnabled: true,
    /** Remind about a cart left untouched this many hours (0 turns reminders off). */
    abandonedCartHours: 6,
    /** Don't remind about carts older than this. */
    abandonedCartMaxDays: 3,
  },
  support: {
    /** Text the customer when staff reply to a ticket. */
    smsOnReply: true,
  },
  returns: {
    windowDays: 7,
    reasons: [
      'Wrong item delivered',
      'Damaged or defective',
      'Not as described',
      'Missing parts or accessories',
      'Size or fit issue',
      'Changed my mind',
    ],
  },
};

export type AppSettings = typeof DEFAULT_SETTINGS;

function isObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

export function deepMerge<T>(base: T, patch: unknown): T {
  if (!isObject(base) || !isObject(patch)) return (patch === undefined ? base : (patch as T));
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [key, value] of Object.entries(patch)) {
    if (!(key in out)) continue; // ignore unknown keys
    out[key] = isObject(out[key]) && isObject(value) ? deepMerge(out[key], value) : value;
  }
  return out as T;
}

@Injectable()
export class SettingsService {
  private cache: { value: AppSettings; at: number } | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async get(): Promise<AppSettings> {
    if (this.cache && Date.now() - this.cache.at < 30_000) return this.cache.value;
    const row = await this.prisma.setting.findUnique({ where: { key: 'app' } });
    const value = deepMerge(DEFAULT_SETTINGS, row?.value ?? {});
    this.cache = { value, at: Date.now() };
    return value;
  }

  async update(patch: unknown): Promise<AppSettings> {
    const current = await this.get();
    const next = deepMerge(current, patch);
    await this.prisma.setting.upsert({
      where: { key: 'app' },
      create: { key: 'app', value: next as unknown as Prisma.InputJsonValue },
      update: { value: next as unknown as Prisma.InputJsonValue },
    });
    this.cache = null;
    return this.get();
  }
}
