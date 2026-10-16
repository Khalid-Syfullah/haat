import { ShipmentState } from '@prisma/client';

export type CourierCode = 'steadfast' | 'pathao' | 'redx' | 'test';

/** What the store knows about an order when it books a consignment. */
export interface BookingInput {
  orderNo: string;
  /** Unique per booking attempt (some couriers refuse a reused invoice). */
  invoice: string;
  name: string;
  phone: string;
  address: string;
  district: string;
  area: string;
  /** Cash the rider collects; 0 for prepaid orders. */
  codAmount: number;
  /** Declared value of the goods (for courier compensation). */
  value: number;
  weightGrams: number;
  itemCount: number;
  itemSummary: string;
  note?: string;
  /** Courier-specific destination ids picked by staff (Pathao city/zone/area, RedX area). */
  location?: { cityId?: number; zoneId?: number; areaId?: number; areaName?: string };
}

export interface BookingResult {
  consignmentId: string;
  trackingCode: string;
  courierStatus: string;
  deliveryFee?: number;
  raw: unknown;
}

/** One status report from a courier, by webhook or by polling. */
export interface CourierUpdate {
  consignmentId?: string;
  trackingCode?: string;
  /** The courier's own status word, e.g. "delivered" or "order.in-transit". */
  status: string;
  state: ShipmentState | null;
  message?: string;
  dedupeKey?: string;
  raw?: unknown;
}

export interface LocationOption {
  id: number;
  name: string;
}

export interface WebhookResult {
  /** Updates to apply; empty for handshakes and events we don't track. */
  updates: CourierUpdate[];
  /** HTTP status and headers the courier expects in reply. */
  status?: number;
  headers?: Record<string, string>;
  body?: unknown;
}

export class CourierError extends Error {
  constructor(
    message: string,
    public readonly detail?: unknown,
  ) {
    super(message);
  }
}

export interface CourierAdapter {
  readonly code: CourierCode;
  /** Name stored on the order and shown to customers. */
  readonly name: string;
  /** Destination ids staff must pick before booking. */
  readonly locationKind: 'pathao' | 'redx' | null;
  configured(): boolean;
  /** Env vars still missing, for the settings page. */
  missing(): string[];
  book(input: BookingInput): Promise<BookingResult>;
  status(shipment: { consignmentId: string; trackingCode: string }): Promise<CourierUpdate | null>;
  /** Verifies and parses a webhook call. Throws CourierError with status 401 on a bad secret. */
  webhook(headers: Record<string, string | undefined>, query: Record<string, string>, body: any, rawBody?: string): WebhookResult;
  locations?(kind: 'city' | 'zone' | 'area', parentId?: number, district?: string): Promise<LocationOption[]>;
}

/** Normalises the many ways couriers spell a status into our six states. */
export function stateFromWords(raw: string): ShipmentState | null {
  const s = raw.toLowerCase().replace(/^order\./, '').replace(/[\s_]+/g, '-');
  if (!s) return null;
  if (s.includes('approval-pending')) return 'IN_TRANSIT'; // rider's report, not yet confirmed by the courier
  if (s.includes('partial')) return 'PARTIAL';
  if (s === 'cancelled' || s.includes('pickup-cancel')) return 'CANCELLED';
  if (s.includes('return')) return s.includes('returning') || s.includes('return-in-transit') || s.includes('return-id') ? 'IN_TRANSIT' : 'RETURNED';
  if (s === 'delivered' || s === 'order-delivered') return 'DELIVERED';
  if (/(created|updated|pickup-requested|assigned-for-pickup|pickup-pending|pending-pickup|in-review|pickup-failed)/.test(s)) return 'BOOKED';
  if (/(picked|transit|hub|sorting|assigned-for-delivery|delivery-in-progress|ready-for-delivery|hold|delivery-failed|area-change|pending|out-for)/.test(s)) return 'IN_TRANSIT';
  return null;
}

export const FINAL_STATES: ShipmentState[] = ['DELIVERED', 'PARTIAL', 'RETURNED', 'CANCELLED'];
