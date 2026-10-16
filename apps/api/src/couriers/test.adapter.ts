import { randomInt } from 'crypto';
import { CourierAdapter, CourierError, CourierUpdate, stateFromWords, WebhookResult } from './courier.types';

/**
 * A stand-in courier for demos and automated tests. Bookings get made-up consignment numbers and
 * staff move them along from the order page (or by webhook with COURIER_TEST_TOKEN).
 * Available outside production, or when COURIER_TEST=true.
 */
export class TestCourierAdapter implements CourierAdapter {
  readonly code = 'test' as const;
  readonly name = 'Test courier';
  readonly locationKind = null;

  missing() {
    return [];
  }

  configured() {
    return process.env.COURIER_TEST === 'true' || process.env.NODE_ENV !== 'production';
  }

  async book() {
    const id = `TC${randomInt(10_000_000, 99_999_999)}`;
    return { consignmentId: id, trackingCode: id, courierStatus: 'booked', deliveryFee: 60, raw: { test: true } };
  }

  /** Nothing to poll: the state only changes when staff or the test webhook say so. */
  async status(): Promise<CourierUpdate | null> {
    return null;
  }

  webhook(headers: Record<string, string | undefined>, _query: Record<string, string>, body: any): WebhookResult {
    const token = process.env.COURIER_TEST_TOKEN || (process.env.NODE_ENV !== 'production' ? 'test' : '');
    if (!token || headers['x-test-courier-token'] !== token) throw new CourierError('Bad test courier token', { status: 401 });
    const id = String(body?.consignment_id ?? '');
    const status = String(body?.status ?? '');
    if (!id || !status) return { updates: [], status: 200, body: { ok: true } };
    return {
      status: 200,
      body: { ok: true },
      updates: [{ consignmentId: id, status, state: stateFromWords(status), message: body.message, dedupeKey: body.event_id ? `test:${body.event_id}` : undefined, raw: body }],
    };
  }
}

export const TEST_STATUSES: { status: string; label: string }[] = [
  { status: 'picked', label: 'Picked up' },
  { status: 'in-transit', label: 'In transit' },
  { status: 'delivered', label: 'Delivered' },
  { status: 'partial-delivery', label: 'Partly delivered' },
  { status: 'returned', label: 'Returned to sender' },
];

export function assertTestStatus(status: string) {
  if (!TEST_STATUSES.some((s) => s.status === status)) throw new CourierError(`Unknown test status "${status}"`);
}
