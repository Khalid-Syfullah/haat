import { BadRequestException } from '@nestjs/common';
import { randomBytes, randomInt } from 'crypto';

/** Bangladesh is UTC+6 all year (no DST). */
const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000;

/** Calendar day in Dhaka as YYYY-MM-DD. */
export function dhakaDay(date = new Date()): string {
  return new Date(date.getTime() + DHAKA_OFFSET_MS).toISOString().slice(0, 10);
}

/** Start of the Dhaka calendar day containing `date`, as a UTC Date. */
export function dhakaDayStart(date = new Date()): Date {
  return new Date(Date.parse(`${dhakaDay(date)}T00:00:00.000Z`) - DHAKA_OFFSET_MS);
}

/** Accepts 01XXXXXXXXX, 8801XXXXXXXXX or +8801XXXXXXXXX and returns 01XXXXXXXXX. */
export function normalizePhone(input: string): string {
  const digits = (input || '').replace(/[^\d]/g, '');
  const local = digits.startsWith('880') ? digits.slice(2) : digits;
  if (!/^01[3-9]\d{8}$/.test(local)) {
    throw new BadRequestException('Enter a valid Bangladeshi mobile number, e.g. 01712345678');
  }
  return local;
}

export function isBdPhone(input: string): boolean {
  try {
    normalizePhone(input);
    return true;
  } catch {
    return false;
  }
}

export function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  // Non-Latin titles still produce a slug; add a short suffix to keep it unique.
  return base || `item-${randomBytes(3).toString('hex')}`;
}

/** e.g. TB2610161234567 — prefix, Dhaka date, random digits. */
export function generateOrderNo(): string {
  const day = dhakaDay().replace(/-/g, '').slice(2);
  return `TB${day}${randomInt(1000000, 9999999)}`;
}

export function randomToken(bytes = 24): string {
  return randomBytes(bytes).toString('base64url');
}

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

/** "Rahim Uddin" → "R*** U***" for public review lists. */
export function maskName(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => `${part[0]}***`)
    .join(' ');
}

/** "Black, 8GB / 128GB". Postgres jsonb reorders keys, so Color always leads and the rest keep a stable order. */
export function variantLabel(options: unknown, order: string[] = []): string | null {
  if (!options || typeof options !== 'object') return null;
  const o = options as Record<string, string>;
  const rank = (k: string) => {
    const i = order.indexOf(k);
    if (i >= 0) return i;
    return k === 'Color' ? -1 : 100;
  };
  const values = Object.keys(o)
    .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))
    .map((k) => o[k])
    .filter(Boolean);
  return values.length ? values.join(', ') : null;
}

export function toInt(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

export function toBool(value: unknown): boolean {
  return value === true || value === 'true' || value === '1' || value === 1;
}
