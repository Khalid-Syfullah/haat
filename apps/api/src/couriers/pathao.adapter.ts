import { timingSafeEqual } from 'crypto';
import { CourierAdapter, CourierError, CourierUpdate, LocationOption, stateFromWords, WebhookResult } from './courier.types';

/**
 * Pathao Courier merchant API ("Aladdin").
 *   PATHAO_CLIENT_ID, PATHAO_CLIENT_SECRET, PATHAO_USERNAME, PATHAO_PASSWORD   merchant API credentials
 *   PATHAO_STORE_ID          pickup store id from the merchant panel
 *   PATHAO_SANDBOX=true      use https://courier-api-sandbox.pathao.com
 *   PATHAO_WEBHOOK_SECRET    the secret entered with the webhook URL in the panel
 *   PATHAO_WEBHOOK_INTEGRATION_SECRET   value Pathao expects back in
 *                            X-Pathao-Merchant-Webhook-Integration-Secret (defaults to PATHAO_WEBHOOK_SECRET)
 * Webhook URL: <API_PUBLIC_URL>/api/couriers/pathao/webhook
 */
export class PathaoAdapter implements CourierAdapter {
  readonly code = 'pathao' as const;
  readonly name = 'Pathao Courier';
  readonly locationKind = 'pathao' as const;

  private token: { value: string; expiresAt: number } | null = null;
  private cache = new Map<string, { at: number; value: LocationOption[] }>();

  private get base() {
    return process.env.PATHAO_SANDBOX === 'true' ? 'https://courier-api-sandbox.pathao.com' : 'https://api-hermes.pathao.com';
  }

  missing() {
    return ['PATHAO_CLIENT_ID', 'PATHAO_CLIENT_SECRET', 'PATHAO_USERNAME', 'PATHAO_PASSWORD', 'PATHAO_STORE_ID'].filter((k) => !process.env[k]);
  }

  configured() {
    return this.missing().length === 0;
  }

  private async accessToken(): Promise<string> {
    if (this.token && this.token.expiresAt > Date.now() + 60_000) return this.token.value;
    const res = await fetch(`${this.base}/aladdin/api/v1/issue-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        client_id: process.env.PATHAO_CLIENT_ID,
        client_secret: process.env.PATHAO_CLIENT_SECRET,
        grant_type: 'password',
        username: process.env.PATHAO_USERNAME,
        password: process.env.PATHAO_PASSWORD,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const data = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; message?: string };
    if (!res.ok || !data.access_token) throw new CourierError(`Pathao login failed: ${data.message ?? `HTTP ${res.status}`}`);
    this.token = { value: data.access_token, expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000 };
    return data.access_token;
  }

  private async call<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = await this.accessToken();
    const res = await fetch(`${this.base}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
      signal: AbortSignal.timeout(20_000),
    });
    const data = (await res.json().catch(() => ({}))) as T & { message?: string; errors?: unknown };
    if (!res.ok) {
      const errors = data.errors ? ` (${JSON.stringify(data.errors).slice(0, 300)})` : '';
      throw new CourierError(`Pathao: ${data.message ?? `HTTP ${res.status}`}${errors}`, data);
    }
    return data;
  }

  /** Pathao reports "Pending" for an order that is booked but not yet picked up. */
  private state(status: string) {
    const s = status.toLowerCase().replace(/^order\./, '');
    if (s === 'pending' || s === 'paid' || s === 'exchanged') return s === 'pending' ? ('BOOKED' as const) : null;
    return stateFromWords(s);
  }

  async book(input: Parameters<CourierAdapter['book']>[0]) {
    const loc = input.location ?? {};
    const body: Record<string, unknown> = {
      store_id: Number(process.env.PATHAO_STORE_ID),
      merchant_order_id: input.invoice,
      recipient_name: input.name.slice(0, 100),
      recipient_phone: input.phone,
      recipient_address: input.address.slice(0, 220),
      delivery_type: 48, // normal delivery
      item_type: 2, // parcel
      special_instruction: input.note?.slice(0, 250) || undefined,
      item_quantity: Math.max(1, input.itemCount),
      item_weight: Math.min(10, Math.max(0.5, Math.round(input.weightGrams / 100) / 10)),
      item_description: input.itemSummary.slice(0, 250),
      amount_to_collect: input.codAmount,
    };
    // Without a city and zone Pathao works them out from the address.
    if (loc.cityId && loc.zoneId) {
      body.recipient_city = loc.cityId;
      body.recipient_zone = loc.zoneId;
      if (loc.areaId) body.recipient_area = loc.areaId;
    }
    const data = await this.call<{ data?: { consignment_id: string; order_status: string; delivery_fee?: number } }>('/aladdin/api/v1/orders', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    if (!data.data?.consignment_id) throw new CourierError('Pathao did not return a consignment id', data);
    return {
      consignmentId: data.data.consignment_id,
      trackingCode: data.data.consignment_id,
      courierStatus: data.data.order_status ?? 'Pending',
      deliveryFee: typeof data.data.delivery_fee === 'number' ? Math.round(data.data.delivery_fee) : undefined,
      raw: data,
    };
  }

  async status(shipment: { consignmentId: string }): Promise<CourierUpdate | null> {
    const data = await this.call<{ data?: { order_status?: string; order_status_slug?: string; updated_at?: string } }>(
      `/aladdin/api/v1/orders/${encodeURIComponent(shipment.consignmentId)}/info`,
    );
    const status = data.data?.order_status_slug ?? data.data?.order_status;
    if (!status) return null;
    return { consignmentId: shipment.consignmentId, status, state: this.state(status), raw: data.data };
  }

  async locations(kind: 'city' | 'zone' | 'area', parentId?: number): Promise<LocationOption[]> {
    const key = `${kind}:${parentId ?? ''}`;
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.at < 24 * 3600_000) return hit.value;
    let value: LocationOption[];
    if (kind === 'city') {
      const d = await this.call<{ data: { data: { city_id: number; city_name: string }[] } }>('/aladdin/api/v1/city-list');
      value = d.data.data.map((c) => ({ id: c.city_id, name: c.city_name }));
    } else if (kind === 'zone') {
      if (!parentId) throw new CourierError('Pick a city first');
      const d = await this.call<{ data: { data: { zone_id: number; zone_name: string }[] } }>(`/aladdin/api/v1/cities/${parentId}/zone-list`);
      value = d.data.data.map((z) => ({ id: z.zone_id, name: z.zone_name }));
    } else {
      if (!parentId) throw new CourierError('Pick a zone first');
      const d = await this.call<{ data: { data: { area_id: number; area_name: string; home_delivery_available?: boolean }[] } }>(
        `/aladdin/api/v1/zones/${parentId}/area-list`,
      );
      value = d.data.data.filter((a) => a.home_delivery_available !== false).map((a) => ({ id: a.area_id, name: a.area_name }));
    }
    this.cache.set(key, { at: Date.now(), value });
    return value;
  }

  webhook(headers: Record<string, string | undefined>, _query: Record<string, string>, body: any): WebhookResult {
    const secret = process.env.PATHAO_WEBHOOK_SECRET;
    if (!secret) throw new CourierError('PATHAO_WEBHOOK_SECRET is not set', { status: 401 });
    // Pathao sends the configured secret itself in X-PATHAO-Signature.
    const given = headers['x-pathao-signature'] ?? '';
    const a = Buffer.from(given);
    const b = Buffer.from(secret);
    if (a.length !== b.length || !timingSafeEqual(a, b)) throw new CourierError('Bad Pathao webhook signature', { status: 401 });

    const reply = {
      status: 202,
      headers: { 'X-Pathao-Merchant-Webhook-Integration-Secret': process.env.PATHAO_WEBHOOK_INTEGRATION_SECRET || secret },
    };
    const event = String(body?.event ?? '');
    if (event === 'webhook_integration' || !event.startsWith('order.') || !body?.consignment_id) {
      return { ...reply, updates: [], body: { message: 'Accepted' } };
    }
    const consignmentId = String(body.consignment_id);
    return {
      ...reply,
      body: { message: 'Accepted' },
      updates: [
        {
          consignmentId,
          status: event,
          state: this.state(event),
          message: body.reason ? String(body.reason) : undefined,
          dedupeKey: `pathao:${consignmentId}:${event}:${body.timestamp ?? body.updated_at ?? ''}`,
          raw: body,
        },
      ],
    };
  }
}
