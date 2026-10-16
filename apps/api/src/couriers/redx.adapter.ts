import { timingSafeEqual } from 'crypto';
import { CourierAdapter, CourierError, CourierUpdate, LocationOption, stateFromWords, WebhookResult } from './courier.types';

/**
 * RedX open API.
 *   REDX_ACCESS_TOKEN       API access token from the RedX merchant panel
 *   REDX_SANDBOX=true       use https://sandbox.redx.com.bd
 *   REDX_PICKUP_STORE_ID    optional pickup store; otherwise the account default is used
 *   REDX_WEBHOOK_TOKEN      a secret of your choice, added to the callback URL as ?token=
 * Callback URL: <API_PUBLIC_URL>/api/couriers/redx/webhook?token=<REDX_WEBHOOK_TOKEN>
 */
export class RedxAdapter implements CourierAdapter {
  readonly code = 'redx' as const;
  readonly name = 'RedX';
  readonly locationKind = 'redx' as const;

  private cache = new Map<string, { at: number; value: LocationOption[] }>();

  private get base() {
    return process.env.REDX_SANDBOX === 'true' ? 'https://sandbox.redx.com.bd/v1.0.0-beta' : 'https://openapi.redx.com.bd/v1.0.0-beta';
  }

  missing() {
    return ['REDX_ACCESS_TOKEN'].filter((k) => !process.env[k]);
  }

  configured() {
    return this.missing().length === 0;
  }

  private async call<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(`${this.base}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'API-ACCESS-TOKEN': `Bearer ${process.env.REDX_ACCESS_TOKEN ?? ''}`,
        ...(init.headers ?? {}),
      },
      signal: AbortSignal.timeout(20_000),
    });
    const text = await res.text();
    let data: any = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { message: text.slice(0, 200) };
    }
    if (!res.ok) throw new CourierError(`RedX: ${data.message ?? data.error ?? `HTTP ${res.status}`}`, data);
    return data as T;
  }

  async book(input: Parameters<CourierAdapter['book']>[0]) {
    const areaId = input.location?.areaId;
    const areaName = input.location?.areaName;
    if (!areaId || !areaName) throw new CourierError('Pick the RedX delivery area for this address');
    const data = await this.call<{ tracking_id?: string }>('/parcel', {
      method: 'POST',
      body: JSON.stringify({
        customer_name: input.name.slice(0, 100),
        customer_phone: input.phone,
        delivery_area: areaName,
        delivery_area_id: areaId,
        customer_address: input.address.slice(0, 250),
        merchant_invoice_id: input.invoice,
        cash_collection_amount: String(input.codAmount),
        parcel_weight: String(Math.max(1, Math.round(input.weightGrams))),
        instruction: input.note?.slice(0, 250) || '',
        value: String(input.value),
        is_closed_box: false,
        ...(process.env.REDX_PICKUP_STORE_ID ? { pickup_store_id: Number(process.env.REDX_PICKUP_STORE_ID) } : {}),
        parcel_details_json: [{ name: input.itemSummary.slice(0, 100), category: 'General', value: input.value }],
      }),
    });
    if (!data.tracking_id) throw new CourierError('RedX did not return a tracking id', data);
    return { consignmentId: data.tracking_id, trackingCode: data.tracking_id, courierStatus: 'pickup-pending', raw: data };
  }

  async status(shipment: { trackingCode: string }): Promise<CourierUpdate | null> {
    const data = await this.call<{ parcel?: { status?: string } }>(`/parcel/info/${encodeURIComponent(shipment.trackingCode)}`);
    const status = data.parcel?.status;
    if (!status) return null;
    return { trackingCode: shipment.trackingCode, status, state: stateFromWords(status), raw: data.parcel };
  }

  /** RedX lists delivery areas per district (kind "area"; parentId unused). */
  async locations(_kind: 'city' | 'zone' | 'area', _parentId?: number, district?: string): Promise<LocationOption[]> {
    const key = district ?? '';
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.at < 24 * 3600_000) return hit.value;
    const q = district ? `?district_name=${encodeURIComponent(district)}` : '';
    const data = await this.call<{ areas?: { id: number; name: string }[] }>(`/areas${q}`);
    const value = (data.areas ?? []).map((a) => ({ id: a.id, name: a.name }));
    this.cache.set(key, { at: Date.now(), value });
    return value;
  }

  webhook(_headers: Record<string, string | undefined>, query: Record<string, string>, body: any): WebhookResult {
    const secret = process.env.REDX_WEBHOOK_TOKEN;
    if (!secret) throw new CourierError('REDX_WEBHOOK_TOKEN is not set', { status: 401 });
    const a = Buffer.from(query.token ?? '');
    const b = Buffer.from(secret);
    if (a.length !== b.length || !timingSafeEqual(a, b)) throw new CourierError('Bad RedX webhook token', { status: 401 });
    const tracking = String(body?.tracking_number ?? body?.tracking_id ?? '');
    const status = String(body?.status ?? '');
    if (!tracking || !status) return { updates: [], status: 200, body: { ok: true } };
    return {
      status: 200,
      body: { ok: true },
      updates: [
        {
          trackingCode: tracking,
          status,
          state: stateFromWords(status),
          message: body.message_en ?? body.message ?? undefined,
          dedupeKey: `redx:${tracking}:${status}:${body.timestamp ?? ''}`,
          raw: body,
        },
      ],
    };
  }
}
