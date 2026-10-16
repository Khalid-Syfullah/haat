import { BadRequestException, Controller, Get, Param, Query, Res } from '@nestjs/common';
import { Permission, Prisma } from '@prisma/client';
import type { Response } from 'express';
import { Audit } from '../common/audit';
import { Perm } from '../common/auth';
import { clamp, dhakaDay, toInt } from '../common/utils';
import { PrismaService } from '../prisma/prisma.service';

const DAY = 86_400_000;
/** Orders that count as sales: placed and not cancelled, refused or still unpaid. */
const COUNTED = Prisma.sql`o.status NOT IN ('CANCELLED', 'DELIVERY_FAILED', 'AWAITING_PAYMENT')`;

interface Range {
  from: string;
  to: string;
  start: Date;
  end: Date;
  days: number;
}

/** from/to are Dhaka calendar days, both inclusive. Defaults to the last 30 days. */
export function parseRange(q: Record<string, string>): Range {
  const valid = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
  const to = valid(q.to) ? q.to : dhakaDay();
  const from = valid(q.from) ? q.from : dhakaDay(new Date(Date.parse(`${to}T12:00:00+06:00`) - 29 * DAY));
  const start = new Date(`${from}T00:00:00+06:00`);
  const end = new Date(new Date(`${to}T00:00:00+06:00`).getTime() + DAY);
  if (end <= start) throw new BadRequestException('The start date must be on or before the end date');
  const days = Math.round((end.getTime() - start.getTime()) / DAY);
  if (days > 731) throw new BadRequestException('Pick a range of two years or less');
  return { from, to, start, end, days };
}

function pct(part: number, whole: number) {
  return whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0;
}

function csv(headers: string[], rows: (string | number | null | undefined)[][]) {
  const cell = (v: string | number | null | undefined) => {
    const s = v == null ? '' : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  // Byte-order mark so Excel opens Bangla text as UTF-8
  return '﻿' + [headers, ...rows].map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n';
}

@Perm(Permission.REPORTS)
@Controller('admin/reports')
export class AdminReportsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('summary')
  async summary(@Query() q: Record<string, string>) {
    const r = parseRange(q);
    const prev = { start: new Date(r.start.getTime() - r.days * DAY), end: r.start };
    const totals = (start: Date, end: Date) => this.prisma.$queryRaw<
      { orders: number; revenue: number; delivered: number; delivered_revenue: number; cod: number; discount: number; coins: number; shipping: number; customers: number }[]
    >`
      SELECT count(*)::int AS orders,
             coalesce(sum(o.total), 0)::int AS revenue,
             count(*) FILTER (WHERE o.status = 'DELIVERED')::int AS delivered,
             coalesce(sum(o.total) FILTER (WHERE o.status = 'DELIVERED'), 0)::int AS delivered_revenue,
             count(*) FILTER (WHERE o."paymentMethod" = 'COD')::int AS cod,
             coalesce(sum(o.discount), 0)::int AS discount,
             coalesce(sum(o."coinsUsed"), 0)::int AS coins,
             coalesce(sum(o."shippingFee" - o."shippingDiscount"), 0)::int AS shipping,
             count(DISTINCT o."userId")::int AS customers
      FROM "Order" o
      WHERE o."createdAt" >= ${start} AND o."createdAt" < ${end} AND ${COUNTED}`;
    const [[cur], [before], [placed], [units], [newCustomers], series] = await Promise.all([
      totals(r.start, r.end),
      totals(prev.start, prev.end),
      this.prisma.$queryRaw<{ placed: number; cancelled: number; failed: number }[]>`
        SELECT count(*)::int AS placed,
               count(*) FILTER (WHERE status = 'CANCELLED')::int AS cancelled,
               count(*) FILTER (WHERE status = 'DELIVERY_FAILED')::int AS failed
        FROM "Order" WHERE "createdAt" >= ${r.start} AND "createdAt" < ${r.end} AND status <> 'AWAITING_PAYMENT'`,
      this.prisma.$queryRaw<{ units: number }[]>`
        SELECT coalesce(sum(oi.quantity), 0)::int AS units
        FROM "OrderItem" oi JOIN "Order" o ON o.id = oi."orderId"
        WHERE o."createdAt" >= ${r.start} AND o."createdAt" < ${r.end} AND ${COUNTED}`,
      this.prisma.$queryRaw<{ count: number }[]>`
        SELECT count(*)::int AS count FROM (
          SELECT o."userId", min(o."createdAt") AS first FROM "Order" o WHERE ${COUNTED} GROUP BY o."userId"
        ) f WHERE f.first >= ${r.start} AND f.first < ${r.end}`,
      this.prisma.$queryRaw<{ day: string; orders: number; revenue: number }[]>`
        SELECT to_char((o."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Dhaka', 'YYYY-MM-DD') AS day,
               count(*)::int AS orders, coalesce(sum(o.total), 0)::int AS revenue
        FROM "Order" o
        WHERE o."createdAt" >= ${r.start} AND o."createdAt" < ${r.end} AND ${COUNTED}
        GROUP BY 1 ORDER BY 1`,
    ]);
    const byDay = new Map(series.map((s) => [s.day, s]));
    const days = Array.from({ length: r.days }, (_, i) => {
      const day = dhakaDay(new Date(r.start.getTime() + i * DAY + 6 * 3600_000));
      return { day, orders: byDay.get(day)?.orders ?? 0, revenue: byDay.get(day)?.revenue ?? 0 };
    });
    const change = (a: number, b: number) => (b > 0 ? Math.round(((a - b) / b) * 1000) / 10 : null);
    return {
      range: { from: r.from, to: r.to, days: r.days },
      orders: cur.orders,
      revenue: cur.revenue,
      units: units.units,
      averageOrder: cur.orders ? Math.round(cur.revenue / cur.orders) : 0,
      deliveredOrders: cur.delivered,
      deliveredRevenue: cur.delivered_revenue,
      discounts: cur.discount,
      coinsRedeemed: cur.coins,
      deliveryCharged: cur.shipping,
      codShare: pct(cur.cod, cur.orders),
      customers: cur.customers,
      newCustomers: newCustomers.count,
      placed: placed.placed,
      cancelled: placed.cancelled,
      failedDeliveries: placed.failed,
      cancelRate: pct(placed.cancelled, placed.placed),
      failedRate: pct(placed.failed, placed.placed),
      previous: { orders: before.orders, revenue: before.revenue, ordersChange: change(cur.orders, before.orders), revenueChange: change(cur.revenue, before.revenue) },
      days,
    };
  }

  /** Sales by top-level category, each with its sub-categories. Revenue is item value before order-level discounts. */
  @Get('categories')
  async categories(@Query() q: Record<string, string>) {
    const r = parseRange(q);
    return { range: { from: r.from, to: r.to }, ...(await this.categoryRows(r)) };
  }

  private async categoryRows(r: Range) {
    const [rows, cats] = await Promise.all([
      this.prisma.$queryRaw<{ orderId: string; categoryId: string; units: number; revenue: number }[]>`
        SELECT oi."orderId", p."categoryId", sum(oi.quantity)::int AS units, sum(oi."lineTotal")::int AS revenue
        FROM "OrderItem" oi JOIN "Order" o ON o.id = oi."orderId" JOIN "Product" p ON p.id = oi."productId"
        WHERE o."createdAt" >= ${r.start} AND o."createdAt" < ${r.end} AND ${COUNTED}
        GROUP BY 1, 2`,
      this.prisma.category.findMany({ select: { id: true, name: true, slug: true, parentId: true } }),
    ]);
    const byId = new Map(cats.map((c) => [c.id, c]));
    const rootOf = (id: string) => {
      let c = byId.get(id);
      while (c?.parentId && byId.get(c.parentId)) c = byId.get(c.parentId);
      return c;
    };
    type Agg = { id: string; name: string; slug: string; orders: Set<string>; units: number; revenue: number };
    const roots = new Map<string, Agg & { children: Map<string, Agg> }>();
    for (const row of rows) {
      const root = rootOf(row.categoryId);
      const leaf = byId.get(row.categoryId);
      if (!root || !leaf) continue;
      let agg = roots.get(root.id);
      if (!agg) {
        agg = { id: root.id, name: root.name, slug: root.slug, orders: new Set(), units: 0, revenue: 0, children: new Map() };
        roots.set(root.id, agg);
      }
      agg.orders.add(row.orderId);
      agg.units += row.units;
      agg.revenue += row.revenue;
      if (leaf.id !== root.id) {
        let child = agg.children.get(leaf.id);
        if (!child) {
          child = { id: leaf.id, name: leaf.name, slug: leaf.slug, orders: new Set(), units: 0, revenue: 0 };
          agg.children.set(leaf.id, child);
        }
        child.orders.add(row.orderId);
        child.units += row.units;
        child.revenue += row.revenue;
      }
    }
    const total = [...roots.values()].reduce((s, a) => s + a.revenue, 0);
    const out = (a: Agg) => ({ id: a.id, name: a.name, slug: a.slug, orders: a.orders.size, units: a.units, revenue: a.revenue, share: pct(a.revenue, total) });
    return {
      totalRevenue: total,
      items: [...roots.values()]
        .sort((a, b) => b.revenue - a.revenue)
        .map((a) => ({ ...out(a), children: [...a.children.values()].sort((x, y) => y.revenue - x.revenue).map(out) })),
    };
  }

  /**
   * Best sellers with their return rate: of the units sold in the range on orders that were delivered,
   * how many came back (returns not rejected).
   */
  @Get('products')
  async products(@Query() q: Record<string, string>) {
    const r = parseRange(q);
    const limit = clamp(toInt(q.limit, 50), 1, 500);
    return { range: { from: r.from, to: r.to }, items: await this.productRows(r, limit, q.sort === 'returns' ? 'returns' : 'revenue') };
  }

  private async productRows(r: Range, limit: number, sort: 'revenue' | 'returns') {
    const rows = await this.prisma.$queryRaw<
      { productId: string; title: string; slug: string; orders: number; units: number; revenue: number; delivered_units: number; returned_units: number }[]
    >`
      SELECT oi."productId", p.title, p.slug,
             count(DISTINCT oi."orderId")::int AS orders,
             sum(oi.quantity)::int AS units,
             sum(oi."lineTotal")::int AS revenue,
             coalesce(sum(oi.quantity) FILTER (WHERE o.status = 'DELIVERED'), 0)::int AS delivered_units,
             coalesce(sum(rr.qty), 0)::int AS returned_units
      FROM "OrderItem" oi
      JOIN "Order" o ON o.id = oi."orderId"
      JOIN "Product" p ON p.id = oi."productId"
      LEFT JOIN (
        SELECT "orderItemId", sum(quantity) AS qty FROM "ReturnRequest" WHERE status <> 'REJECTED' GROUP BY 1
      ) rr ON rr."orderItemId" = oi.id
      WHERE o."createdAt" >= ${r.start} AND o."createdAt" < ${r.end} AND ${COUNTED}
      GROUP BY 1, 2, 3`;
    const items = rows.map((x) => ({
      productId: x.productId,
      title: x.title,
      slug: x.slug,
      orders: x.orders,
      units: x.units,
      revenue: x.revenue,
      deliveredUnits: x.delivered_units,
      returnedUnits: x.returned_units,
      returnRate: pct(x.returned_units, x.delivered_units),
    }));
    items.sort((a, b) => (sort === 'returns' ? b.returnedUnits - a.returnedUnits || b.returnRate - a.returnRate : b.revenue - a.revenue));
    return items.slice(0, limit);
  }

  /** Return on spend: order revenue that used the voucher, per taka of discount it gave. */
  @Get('vouchers')
  async vouchers(@Query() q: Record<string, string>) {
    const r = parseRange(q);
    return { range: { from: r.from, to: r.to }, items: await this.voucherRows(r) };
  }

  private async voucherRows(r: Range) {
    const rows = await this.prisma.$queryRaw<
      { id: string; code: string; title: string; type: string; uses: number; customers: number; discount: number; revenue: number; delivered_revenue: number }[]
    >`
      SELECT v.id, v.code, v.title, v.type::text AS type,
             count(vr.id)::int AS uses,
             count(DISTINCT vr."userId")::int AS customers,
             coalesce(sum(vr.discount), 0)::int AS discount,
             coalesce(sum(o.total), 0)::int AS revenue,
             coalesce(sum(o.total) FILTER (WHERE o.status = 'DELIVERED'), 0)::int AS delivered_revenue
      FROM "VoucherRedemption" vr
      JOIN "Voucher" v ON v.id = vr."voucherId"
      JOIN "Order" o ON o.id = vr."orderId"
      WHERE vr."reversedAt" IS NULL AND o."createdAt" >= ${r.start} AND o."createdAt" < ${r.end} AND ${COUNTED}
      GROUP BY v.id
      ORDER BY revenue DESC`;
    return rows.map((v) => ({
      voucherId: v.id,
      code: v.code,
      title: v.title,
      type: v.type,
      uses: v.uses,
      customers: v.customers,
      discount: v.discount,
      revenue: v.revenue,
      deliveredRevenue: v.delivered_revenue,
      averageOrder: v.uses ? Math.round(v.revenue / v.uses) : 0,
      returnOnSpend: v.discount > 0 ? Math.round((v.revenue / v.discount) * 10) / 10 : null,
    }));
  }

  @Get('returns')
  async returns(@Query() q: Record<string, string>) {
    const r = parseRange(q);
    const where: Prisma.ReturnRequestWhereInput = { createdAt: { gte: r.start, lt: r.end } };
    const [byStatus, byReason, refunded, [delivered], products] = await Promise.all([
      this.prisma.returnRequest.groupBy({ by: ['status'], where, _count: { _all: true }, _sum: { quantity: true } }),
      this.prisma.returnRequest.groupBy({ by: ['reason'], where: { ...where, status: { not: 'REJECTED' } }, _count: { _all: true }, _sum: { quantity: true } }),
      this.prisma.returnRequest.aggregate({ where: { ...where, status: 'REFUNDED' }, _sum: { refundAmount: true } }),
      this.prisma.$queryRaw<{ units: number }[]>`
        SELECT coalesce(sum(oi.quantity), 0)::int AS units
        FROM "OrderItem" oi JOIN "Order" o ON o.id = oi."orderId"
        WHERE o.status = 'DELIVERED' AND o."deliveredAt" >= ${r.start} AND o."deliveredAt" < ${r.end}`,
      this.productRows(r, 20, 'returns'),
    ]);
    const requestedUnits = byStatus.filter((s) => s.status !== 'REJECTED').reduce((s, x) => s + (x._sum.quantity ?? 0), 0);
    return {
      range: { from: r.from, to: r.to },
      requests: byStatus.reduce((s, x) => s + x._count._all, 0),
      units: requestedUnits,
      deliveredUnits: delivered.units,
      returnRate: pct(requestedUnits, delivered.units),
      refunded: refunded._sum.refundAmount ?? 0,
      byStatus: Object.fromEntries(byStatus.map((s) => [s.status, s._count._all])),
      byReason: byReason
        .map((x) => ({ reason: x.reason, requests: x._count._all, units: x._sum.quantity ?? 0 }))
        .sort((a, b) => b.requests - a.requests),
      products: products.filter((p) => p.returnedUnits > 0),
    };
  }

  /** CSV download of any report, or of the orders themselves. */
  @Audit({
    action: 'report.export',
    entity: 'report',
    summary: ({ params }) => `Downloaded the ${params.name} report as CSV`,
  })
  @Get('export/:name')
  async export(@Param('name') name: string, @Query() q: Record<string, string>, @Res() res: Response) {
    const r = parseRange(q);
    let body: string;
    switch (name) {
      case 'categories': {
        const { items } = await this.categoryRows(r);
        const rows = items.flatMap((c) => [
          [c.name, '', c.orders, c.units, c.revenue, c.share],
          ...c.children.map((s) => [c.name, s.name, s.orders, s.units, s.revenue, s.share]),
        ]);
        body = csv(['Category', 'Sub-category', 'Orders', 'Units', 'Revenue (BDT)', 'Share of revenue (%)'], rows);
        break;
      }
      case 'products': {
        const items = await this.productRows(r, 5000, 'revenue');
        body = csv(
          ['Product', 'Orders', 'Units', 'Revenue (BDT)', 'Delivered units', 'Returned units', 'Return rate (%)'],
          items.map((p) => [p.title, p.orders, p.units, p.revenue, p.deliveredUnits, p.returnedUnits, p.returnRate]),
        );
        break;
      }
      case 'vouchers': {
        const items = await this.voucherRows(r);
        body = csv(
          ['Code', 'Title', 'Type', 'Uses', 'Customers', 'Discount given (BDT)', 'Order revenue (BDT)', 'Delivered revenue (BDT)', 'Average order (BDT)', 'Revenue per taka of discount'],
          items.map((v) => [v.code, v.title, v.type, v.uses, v.customers, v.discount, v.revenue, v.deliveredRevenue, v.averageOrder, v.returnOnSpend]),
        );
        break;
      }
      case 'returns': {
        const rows = await this.prisma.returnRequest.findMany({
          where: { createdAt: { gte: r.start, lt: r.end } },
          orderBy: { createdAt: 'asc' },
          include: { order: { select: { orderNo: true } }, orderItem: { select: { title: true, variantLabel: true, unitPrice: true } }, user: { select: { name: true, phone: true } } },
        });
        body = csv(
          ['Requested', 'Order', 'Customer', 'Phone', 'Item', 'Variant', 'Quantity', 'Reason', 'Status', 'Refund (BDT)', 'Refund method', 'Resolved'],
          rows.map((x) => [
            dhakaStamp(x.createdAt),
            x.order.orderNo,
            x.user.name,
            x.user.phone,
            x.orderItem.title,
            x.orderItem.variantLabel,
            x.quantity,
            x.reason,
            x.status,
            x.refundAmount,
            x.status === 'REFUNDED' ? x.refundMethod : '',
            x.resolvedAt ? dhakaStamp(x.resolvedAt) : '',
          ]),
        );
        break;
      }
      case 'orders': {
        const orders = await this.prisma.order.findMany({
          where: { createdAt: { gte: r.start, lt: r.end } },
          orderBy: { createdAt: 'asc' },
          include: { _count: { select: { items: true } } },
        });
        body = csv(
          ['Order', 'Placed', 'Status', 'Payment method', 'Payment status', 'Customer', 'Phone', 'District', 'Lines', 'Subtotal', 'Delivery', 'Delivery discount', 'Discount', 'Voucher', 'Coins', 'Total', 'Courier', 'Tracking', 'COD risk'],
          orders.map((o) => [
            o.orderNo,
            dhakaStamp(o.createdAt),
            o.status,
            o.paymentMethod,
            o.paymentStatus,
            o.shipName,
            o.shipPhone,
            o.shipDistrict,
            o._count.items,
            o.subtotal,
            o.shippingFee,
            o.shippingDiscount,
            o.discount,
            o.voucherCode,
            o.coinsUsed,
            o.total,
            o.courier,
            o.trackingNo,
            o.riskScore,
          ]),
        );
        break;
      }
      default:
        throw new BadRequestException('Unknown report');
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="haat-${name}-${r.from}-to-${r.to}.csv"`);
    res.setHeader('Cache-Control', 'no-store');
    res.send(body);
  }
}

/** "2026-10-16 14:05" in Dhaka time. */
function dhakaStamp(d: Date) {
  return new Date(d.getTime() + 6 * 3600_000).toISOString().slice(0, 16).replace('T', ' ');
}
