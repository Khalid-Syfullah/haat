import { createHmac, timingSafeEqual } from 'crypto';
import { CourierAdapter, CourierError, CourierUpdate, stateFromWords, WebhookResult } from './courier.types';

/**
 * Steadfast (Packzy) merchant API.
 *   STEADFAST_API_KEY, STEADFAST_SECRET_KEY   from the merchant panel's API page
 *   STEADFAST_WEBHOOK_TOKEN                    the "Auth token" set on the panel's Webhook page
 *   STEADFAST_BASE_URL                         default https://portal.packzy.com/api/v1
 * Webhook URL to enter in the panel: <API_PUBLIC_URL>/api/couriers/steadfast/webhook
 */
export class SteadfastAdapter implements CourierAdapter {
  readonly code = 'steadfast' as const;
  readonly name = 'Steadfast';
  readonly locationKind = null;

  private get base() {
    return (process.env.STEADFAST_BASE_URL || 'https://portal.packzy.com/api/v1').replace(/\/+$/, '');
  }

  missing() {
    return ['STEADFAST_API_KEY', 'STEADFAST_SECRET_KEY'].filter((k) => !process.env[k]);
  }

  configured() {
    return this.missing().length === 0;
  }

  private headers() {
    return {
      'Api-Key': process.env.STEADFAST_API_KEY ?? '',
      'Secret-Key': process.env.STEADFAST_SECRET_KEY ?? '',
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
  }

  /** Steadfast's "cancelled" is a failed delivery coming back to us, not a cancelled booking. */
  private state(status: string) {
    const s = status.toLowerCase();
    if (s === 'cancelled') return 'RETURNED' as const;
    if (s === 'unknown' || s === 'exceptional') return null;
    return stateFromWords(s);
  }

  async book(input: Parameters<CourierAdapter['book']>[0]) {
    const res = await fetch(`${this.base}/create_order`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        invoice: input.invoice,
        recipient_name: input.name.slice(0, 100),
        recipient_phone: input.phone,
        recipient_address: input.address.slice(0, 250),
        cod_amount: input.codAmount,
        note: input.note?.slice(0, 250) || undefined,
        item_description: input.itemSummary.slice(0, 250),
        total_lot: input.itemCount,
        delivery_type: 0, // home delivery
      }),
      signal: AbortSignal.timeout(20_000),
    });
    const data = (await res.json().catch(() => ({}))) as {
      status?: number;
      message?: string;
      errors?: unknown;
      consignment?: { consignment_id: number | string; tracking_code: string; status: string };
    };
    if (!res.ok || data.status !== 200 || !data.consignment) {
      throw new CourierError(`Steadfast refused the booking: ${data.message ?? `HTTP ${res.status}`}`, data);
    }
    return {
      consignmentId: String(data.consignment.consignment_id),
      trackingCode: data.consignment.tracking_code,
      courierStatus: data.consignment.status ?? 'in_review',
      raw: data,
    };
  }

  async status(shipment: { consignmentId: string }): Promise<CourierUpdate | null> {
    const res = await fetch(`${this.base}/status_by_cid/${encodeURIComponent(shipment.consignmentId)}`, {
      headers: this.headers(),
      signal: AbortSignal.timeout(15_000),
    });
    const data = (await res.json().catch(() => ({}))) as { status?: number; delivery_status?: string };
    if (!res.ok || !data.delivery_status) throw new CourierError(`Steadfast status check failed (HTTP ${res.status})`, data);
    return { consignmentId: shipment.consignmentId, status: data.delivery_status, state: this.state(data.delivery_status), raw: data };
  }

  webhook(headers: Record<string, string | undefined>, _query: Record<string, string>, body: any, rawBody?: string): WebhookResult {
    const token = process.env.STEADFAST_WEBHOOK_TOKEN;
    if (!token) throw new CourierError('STEADFAST_WEBHOOK_TOKEN is not set', { status: 401 });
    const auth = headers['authorization'] ?? '';
    if (!safeEqual(auth.replace(/^Bearer\s+/i, ''), token)) throw new CourierError('Bad Steadfast webhook token', { status: 401 });
    // Steadfast also signs the raw body (HMAC-SHA256 with the token) on some accounts; check it when sent.
    const signature = headers['x-signature'];
    if (signature && rawBody) {
      const expected = createHmac('sha256', token).update(rawBody).digest('hex');
      if (!safeEqual(signature, expected)) throw new CourierError('Bad Steadfast webhook signature', { status: 401 });
    }
    const type = String(body?.notification_type ?? '');
    const consignmentId = body?.consignment_id != null ? String(body.consignment_id) : undefined;
    const idem = headers['idempotency-key'];
    if (!consignmentId) return { updates: [], status: 200, body: { status: 'success', message: 'ignored' } };
    if (type === 'delivery_status') {
      const status = String(body.status ?? '').toLowerCase();
      return {
        updates: [
          {
            consignmentId,
            status,
            state: this.state(status),
            message: body.tracking_message ?? undefined,
            dedupeKey: `steadfast:${idem ?? `${consignmentId}:${status}:${body.updated_at ?? ''}`}`,
            raw: body,
          },
        ],
        status: 200,
        body: { status: 'success', message: 'Webhook received' },
      };
    }
    if (type === 'tracking_update') {
      return {
        updates: [
          {
            consignmentId,
            status: 'tracking_update',
            state: null,
            message: body.tracking_message ?? undefined,
            dedupeKey: `steadfast:${idem ?? `${consignmentId}:t:${body.updated_at ?? ''}`}`,
            raw: body,
          },
        ],
        status: 200,
        body: { status: 'success', message: 'Webhook received' },
      };
    }
    return { updates: [], status: 200, body: { status: 'success', message: 'ignored' } };
  }
}

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
