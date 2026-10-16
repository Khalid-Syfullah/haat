import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma, Shipment, ShipmentState } from '@prisma/client';
import { AuthUser } from '../common/auth';
import { OrderWorkflowService } from '../orders/order-workflow.service';
import { PrismaService } from '../prisma/prisma.service';
import { BookingInput, CourierAdapter, CourierCode, CourierError, CourierUpdate, FINAL_STATES, stateFromWords } from './courier.types';
import { PathaoAdapter } from './pathao.adapter';
import { RedxAdapter } from './redx.adapter';
import { SteadfastAdapter } from './steadfast.adapter';
import { assertTestStatus, TestCourierAdapter, TEST_STATUSES } from './test.adapter';

/** BOOKED < IN_TRANSIT < any final state. Updates never move a shipment backwards. */
const RANK: Record<ShipmentState, number> = { BOOKED: 0, IN_TRANSIT: 1, DELIVERED: 2, PARTIAL: 2, RETURNED: 2, CANCELLED: 2 };

export const STATE_LABELS: Record<ShipmentState, string> = {
  BOOKED: 'Booked, waiting for pickup',
  IN_TRANSIT: 'With the courier',
  DELIVERED: 'Delivered',
  PARTIAL: 'Partly delivered',
  RETURNED: 'Returned to sender',
  CANCELLED: 'Consignment cancelled',
};

export interface BookOptions {
  courier: CourierCode;
  note?: string;
  weightGrams?: number;
  location?: BookingInput['location'];
}

@Injectable()
export class CouriersService {
  private readonly logger = new Logger('Couriers');
  readonly adapters: Record<CourierCode, CourierAdapter> = {
    steadfast: new SteadfastAdapter(),
    pathao: new PathaoAdapter(),
    redx: new RedxAdapter(),
    test: new TestCourierAdapter(),
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly workflow: OrderWorkflowService,
  ) {}

  adapter(code: string): CourierAdapter {
    const a = this.adapters[code as CourierCode];
    if (!a) throw new NotFoundException('Unknown courier');
    return a;
  }

  /** Couriers for the booking dialog and the settings page. */
  list() {
    const publicUrl = (process.env.API_PUBLIC_URL || 'http://localhost:4000').replace(/\/+$/, '');
    return (Object.values(this.adapters) as CourierAdapter[])
      .filter((a) => a.code !== 'test' || a.configured())
      .map((a) => ({
        code: a.code,
        name: a.name,
        configured: a.configured(),
        missing: a.missing(),
        locationKind: a.locationKind,
        test: a.code === 'test',
        testStatuses: a.code === 'test' ? TEST_STATUSES : undefined,
        webhookUrl: `${publicUrl}/api/couriers/${a.code}/webhook${a.code === 'redx' ? '?token=<REDX_WEBHOOK_TOKEN>' : ''}`,
      }));
  }

  async locations(code: string, kind: 'city' | 'zone' | 'area', parentId?: number, district?: string) {
    const a = this.adapter(code);
    if (!a.locations) return [];
    if (!a.configured()) throw new BadRequestException(`${a.name} is not set up on this server yet`);
    try {
      return await a.locations(kind, parentId, district);
    } catch (err) {
      throw new BadRequestException(err instanceof Error ? err.message : 'Could not load areas from the courier');
    }
  }

  /** Books a consignment for a packed order and marks the order shipped with its tracking code. */
  async book(orderId: string, opts: BookOptions, user: AuthUser) {
    const a = this.adapter(opts.courier);
    if (!a.configured()) throw new BadRequestException(`${a.name} is not set up on this server yet`);
    const found = await this.prisma.order.findFirst({ where: { OR: [{ id: orderId }, { orderNo: orderId }] }, select: { id: true } });
    if (!found) throw new NotFoundException('Order not found');

    // One booking per order at a time. The order row stays locked while the courier is called and
    // the consignment is recorded. A double click or a second staff member is turned away at once
    // (NOWAIT), rather than queueing behind a slow courier and booking again after it.
    const { order, rebook, input, booked, shipment } = await this.prisma.$transaction(
      async (tx) => {
        try {
          await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${found.id} FOR UPDATE NOWAIT`;
        } catch (err) {
          // 55P03 lock_not_available: someone else is booking or updating this order right now
          if (String(err).includes('55P03')) throw new ConflictException('This order is being booked or updated right now. Refresh the page in a moment.');
          throw err;
        }
        const order = await tx.order.findUniqueOrThrow({
          where: { id: found.id },
          include: { items: { include: { variant: { select: { product: { select: { weightGrams: true } } } } } }, shipments: true },
        });
        // A shipped order whose consignment the courier cancelled can be booked again.
        const rebook = order.status === 'SHIPPED' && order.shipments.length > 0 && order.shipments.every((s) => s.state === 'CANCELLED');
        if (order.status !== 'PACKED' && !rebook) throw new BadRequestException('Pack the order before booking a courier');
        const active = order.shipments.find((s) => !['CANCELLED', 'RETURNED'].includes(s.state));
        if (active) throw new BadRequestException(`This order already has a ${this.adapter(active.courier).name} consignment (${active.trackingCode})`);

        const units = order.items.reduce((s, i) => s + i.quantity, 0);
        const weight = opts.weightGrams ?? order.items.reduce((s, i) => s + i.quantity * i.variant.product.weightGrams, 0);
        const input: BookingInput = {
          orderNo: order.orderNo,
          invoice: order.shipments.length ? `${order.orderNo}-${order.shipments.length + 1}` : order.orderNo,
          name: order.shipName,
          phone: order.shipPhone,
          address: `${order.shipLine}, ${order.shipArea}, ${order.shipDistrict}`,
          district: order.shipDistrict,
          area: order.shipArea,
          codAmount: order.paymentStatus === 'PAID' ? 0 : order.total,
          value: order.subtotal,
          weightGrams: Math.max(100, weight),
          itemCount: units,
          itemSummary: order.items.map((i) => `${i.quantity}× ${i.title}`).join(', '),
          note: opts.note?.trim() || order.note || undefined,
          location: opts.location,
        };

        let booked;
        try {
          booked = await a.book(input);
        } catch (err) {
          this.logger.warn(`Booking ${order.orderNo} with ${a.name} failed: ${String(err)}`);
          throw new BadRequestException(err instanceof CourierError ? err.message : `${a.name} did not answer. Try again in a minute.`);
        }

        // The consignment exists at the courier now, so record it before anything else can fail.
        const shipment = await tx.shipment.create({
          data: {
            orderId: order.id,
            courier: a.code,
            consignmentId: booked.consignmentId,
            trackingCode: booked.trackingCode,
            courierStatus: booked.courierStatus,
            codAmount: input.codAmount,
            deliveryFee: booked.deliveryFee,
            note: input.note,
            raw: (booked.raw ?? Prisma.JsonNull) as Prisma.InputJsonValue,
            createdById: user.id,
            lastEventAt: new Date(),
            events: { create: { status: booked.courierStatus, message: `Booked by ${user.name}`, source: 'booking' } },
          },
        });
        return { order, rebook, input, booked, shipment };
      },
      // Courier calls time out after 35 seconds at most (Pathao: token, then booking).
      { timeout: 60_000, maxWait: 10_000 },
    );
    const note = `${a.name} consignment ${booked.trackingCode}${input.codAmount ? ` · collect ৳${input.codAmount}` : ' · prepaid'}`;
    if (rebook) {
      await this.prisma.$transaction(async (tx) => {
        await tx.order.update({ where: { id: order.id }, data: { courier: a.name, trackingNo: booked.trackingCode } });
        await tx.orderEvent.create({ data: { orderId: order.id, title: 'Booked with a new courier', note, actor: 'admin', actorId: user.id, actorName: user.name } });
        await tx.notification.create({
          data: {
            userId: order.userId,
            type: 'order',
            title: 'New tracking number',
            body: `Order ${order.orderNo} is now with ${a.name}. Tracking: ${booked.trackingCode}.`,
            link: `/account/orders/${order.orderNo}`,
          },
        });
      });
    } else {
      await this.workflow.transition(order.id, 'SHIPPED', {
        actor: 'admin',
        actorId: user.id,
        actorName: user.name,
        courier: a.name,
        trackingNo: booked.trackingCode,
        note,
      });
    }
    return shipment;
  }

  /** Applies one courier report. Safe to call twice with the same dedupeKey. */
  async apply(shipment: Shipment, update: CourierUpdate, source: 'webhook' | 'sync' | 'staff') {
    if (update.dedupeKey && (await this.prisma.shipmentEvent.findUnique({ where: { dedupeKey: update.dedupeKey } }))) {
      return { applied: false, shipment };
    }
    const moves = update.state !== null && RANK[update.state] > RANK[shipment.state] && !FINAL_STATES.includes(shipment.state);
    // Polling repeats the same status; only a change is worth an event.
    if (source === 'sync' && !moves && update.status === shipment.courierStatus) {
      await this.prisma.shipment.update({ where: { id: shipment.id }, data: { lastSyncAt: new Date() } });
      return { applied: false, shipment };
    }
    let updated: Shipment;
    try {
      updated = await this.prisma.$transaction(async (tx) => {
        await tx.shipmentEvent.create({
          data: {
            shipmentId: shipment.id,
            status: update.status,
            message: update.message?.slice(0, 500),
            source,
            dedupeKey: update.dedupeKey,
            raw: (update.raw ?? Prisma.JsonNull) as Prisma.InputJsonValue,
          },
        });
        return tx.shipment.update({
          where: { id: shipment.id },
          data: {
            courierStatus: update.status,
            lastEventAt: new Date(),
            ...(source === 'sync' ? { lastSyncAt: new Date() } : {}),
            ...(moves ? { state: update.state! } : {}),
          },
        });
      });
    } catch (err) {
      // A retried webhook racing its own first delivery
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') return { applied: false, shipment };
      throw err;
    }
    if (moves) await this.onState(updated, update);
    return { applied: true, shipment: updated };
  }

  /** What a new final state means for the order. */
  private async onState(shipment: Shipment, update: CourierUpdate) {
    const order = await this.prisma.order.findUnique({ where: { id: shipment.orderId } });
    if (!order || order.status !== 'SHIPPED') return;
    const name = this.adapter(shipment.courier).name;
    const detail = update.message ? `: ${update.message}` : '';
    try {
      switch (shipment.state) {
        case 'DELIVERED':
          await this.workflow.transition(order.id, 'DELIVERED', { actor: 'system', note: `${name} confirmed delivery` });
          break;
        case 'RETURNED':
          await this.workflow.transition(order.id, 'DELIVERY_FAILED', { actor: 'system', reason: `${name} returned the parcel${detail}` });
          break;
        case 'PARTIAL':
        case 'CANCELLED':
          // Needs a person: record it for staff and show it on the dashboard.
          await this.prisma.orderEvent.create({
            data: {
              orderId: order.id,
              title: shipment.state === 'PARTIAL' ? 'Courier reports a partial delivery' : 'Courier cancelled the consignment',
              note:
                shipment.state === 'PARTIAL'
                  ? `${name}${detail}. Check what came back, record a return for it, then mark the order delivered.`
                  : `${name}${detail}. Book a courier again from the order page, or ship it another way.`,
              actor: 'system',
              internal: true,
            },
          });
          break;
      }
    } catch (err) {
      this.logger.warn(`Could not update order ${order.orderNo} after ${shipment.state}: ${String(err)}`);
    }
  }

  async handleWebhook(code: string, headers: Record<string, string | undefined>, query: Record<string, string>, body: unknown, rawBody?: string) {
    const a = this.adapter(code);
    const result = a.webhook(headers, query, body ?? {}, rawBody);
    for (const update of result.updates) {
      const shipment = await this.prisma.shipment.findFirst({
        where: {
          courier: a.code,
          OR: [
            ...(update.consignmentId ? [{ consignmentId: update.consignmentId }] : []),
            ...(update.trackingCode ? [{ trackingCode: update.trackingCode }] : []),
          ],
        },
      });
      if (!shipment) {
        this.logger.warn(`${a.name} webhook for unknown consignment ${update.consignmentId ?? update.trackingCode}`);
        continue;
      }
      await this.apply(shipment, update, 'webhook');
    }
    return result;
  }

  /** Asks the courier for the latest status (the "Refresh" button and the 30-minute job). */
  async sync(shipmentId: string) {
    const shipment = await this.prisma.shipment.findUnique({ where: { id: shipmentId } });
    if (!shipment) throw new NotFoundException('Shipment not found');
    const a = this.adapter(shipment.courier);
    if (!a.configured()) throw new BadRequestException(`${a.name} is not set up on this server`);
    let update: CourierUpdate | null;
    try {
      update = await a.status(shipment);
    } catch (err) {
      throw new BadRequestException(err instanceof Error ? err.message : `${a.name} did not answer`);
    }
    if (!update) {
      await this.prisma.shipment.update({ where: { id: shipment.id }, data: { lastSyncAt: new Date() } });
      return this.prisma.shipment.findUniqueOrThrow({ where: { id: shipment.id } });
    }
    return (await this.apply(shipment, update, 'sync')).shipment;
  }

  async syncActive(limit = 100) {
    const cutoff = new Date(Date.now() - 25 * 60_000);
    const open = await this.prisma.shipment.findMany({
      where: { state: { in: ['BOOKED', 'IN_TRANSIT'] }, courier: { not: 'test' }, OR: [{ lastSyncAt: null }, { lastSyncAt: { lt: cutoff } }] },
      orderBy: { lastSyncAt: { sort: 'asc', nulls: 'first' } },
      take: limit,
    });
    let changed = 0;
    for (const s of open) {
      if (!this.adapter(s.courier).configured()) continue;
      try {
        const before = s.state;
        const after = await this.sync(s.id);
        if (after.state !== before) changed++;
      } catch (err) {
        this.logger.warn(`Sync of ${s.courier} ${s.trackingCode} failed: ${String(err)}`);
      }
    }
    return { checked: open.length, changed, repaired: await this.repairOrders(limit) };
  }

  /**
   * A delivered or returned parcel whose order is still "shipped": the order update after the
   * courier's report failed (database error, restart). Runs it again. A delivered or returned
   * consignment is never replaced by a newer one, so it alone decides the order.
   */
  async repairOrders(limit = 100) {
    const stuck = await this.prisma.shipment.findMany({
      where: { state: { in: ['DELIVERED', 'RETURNED'] }, order: { status: 'SHIPPED' } },
      orderBy: { lastEventAt: 'asc' },
      take: limit,
    });
    let repaired = 0;
    for (const s of stuck) {
      await this.onState(s, { consignmentId: s.consignmentId, status: s.courierStatus ?? s.state, state: s.state });
      const order = await this.prisma.order.findUnique({ where: { id: s.orderId }, select: { status: true } });
      if (order?.status !== 'SHIPPED') repaired++;
    }
    return repaired;
  }

  /** Test courier only: staff move the parcel along by hand. */
  async simulate(shipmentId: string, status: string, user: AuthUser) {
    const shipment = await this.prisma.shipment.findUnique({ where: { id: shipmentId } });
    if (!shipment) throw new NotFoundException('Shipment not found');
    if (shipment.courier !== 'test') throw new BadRequestException('Only test courier shipments can be moved by hand');
    try {
      assertTestStatus(status);
    } catch (err) {
      throw new BadRequestException((err as Error).message);
    }
    const update: CourierUpdate = { consignmentId: shipment.consignmentId, status, state: stateFromWords(status), message: `Simulated by ${user.name}` };
    return (await this.apply(shipment, update, 'staff')).shipment;
  }
}
