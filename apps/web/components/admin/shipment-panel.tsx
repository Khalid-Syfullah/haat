'use client';

import { Copy, RefreshCw, TriangleAlert } from 'lucide-react';
import { useToast } from '@/components/providers';
import { Badge, Button, clsx } from '@/components/ui';
import { post } from '@/lib/api';
import { dateTime, relative, tk } from '@/lib/format';
import { Panel, type Tone } from './bits';
import type { AdminShipment, CourierCode, CourierOption, ShipmentState } from './types';
import { useAction } from './use-action';

export const SHIPMENT_STATE: Record<ShipmentState, { label: string; tone: Tone }> = {
  BOOKED: { label: 'Booked, waiting for pickup', tone: 'neutral' },
  IN_TRANSIT: { label: 'With the courier', tone: 'blue' },
  DELIVERED: { label: 'Delivered', tone: 'green' },
  PARTIAL: { label: 'Partly delivered', tone: 'amber' },
  RETURNED: { label: 'Returned to sender', tone: 'red' },
  CANCELLED: { label: 'Consignment cancelled', tone: 'red' },
};

const FINAL: ShipmentState[] = ['DELIVERED', 'PARTIAL', 'RETURNED', 'CANCELLED'];

const COURIER_NAME: Record<CourierCode, string> = { steadfast: 'Steadfast', pathao: 'Pathao Courier', redx: 'RedX', test: 'Test courier' };

const SOURCE: Record<string, string> = { booking: 'Booking', webhook: 'Courier update', sync: 'Status check', staff: 'Moved by staff' };

const PROBLEM: Partial<Record<ShipmentState, string>> = {
  PARTIAL: 'The courier delivered only part of this order. Check which items came back, record them as a return, then mark the order as delivered.',
  CANCELLED:
    'The courier cancelled this consignment, so nobody is bringing the parcel. Ask the courier why, then send it another way and add a staff note with the new tracking number, or mark the delivery as failed.',
};

/** "order.in-transit" → "In transit" */
function humanize(status: string) {
  const s = status.replace(/^order\./i, '').replace(/[-_.]+/g, ' ').trim();
  return s ? s[0].toUpperCase() + s.slice(1).toLowerCase() : status;
}

export function ShipmentPanel({ shipments, couriers }: { shipments: AdminShipment[]; couriers: CourierOption[] | null }) {
  return (
    <Panel title="Courier" bodyClassName="divide-y divide-line">
      {shipments.map((s, i) => (
        <ShipmentCard key={s.id} shipment={s} couriers={couriers} earlier={i > 0} />
      ))}
    </Panel>
  );
}

function ShipmentCard({ shipment: s, couriers, earlier }: { shipment: AdminShipment; couriers: CourierOption[] | null; earlier: boolean }) {
  const { run, busy } = useAction();
  const toast = useToast();
  const info = couriers?.find((c) => c.code === s.courier);
  const name = info?.name ?? COURIER_NAME[s.courier] ?? s.courier;
  const test = s.courier === 'test';
  const final = FINAL.includes(s.state);
  const state = SHIPMENT_STATE[s.state] ?? { label: s.state, tone: 'neutral' as Tone };
  const testLabels = new Map((info?.testStatuses ?? []).map((t) => [t.status, t.label]));
  const statusLabel = (status: string) => testLabels.get(status) ?? humanize(status);
  const problem = PROBLEM[s.state];

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(s.trackingCode);
      toast('Tracking number copied');
    } catch {
      toast('Could not copy. Select the number and copy it by hand.', 'error');
    }
  };

  const sync = async () => {
    const fresh = await run(`sync-${s.id}`, () => post<AdminShipment>(`/admin/shipments/${s.id}/sync`));
    if (!fresh) return;
    if (fresh.state !== s.state || fresh.courierStatus !== s.courierStatus) {
      toast(`Status updated: ${SHIPMENT_STATE[fresh.state]?.label ?? fresh.state}`);
    } else {
      toast('No change from the courier yet');
    }
  };

  return (
    <article className="space-y-3 p-4 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-ink">
            {test ? 'Test courier (not real)' : name}
            {earlier && <span className="ml-1.5 text-xs font-normal text-ink-soft">earlier booking</span>}
          </p>
          <p className="text-xs text-ink-soft">
            Booked <time suppressHydrationWarning>{dateTime(s.createdAt)}</time>
          </p>
        </div>
        <Badge tone={state.tone}>{state.label}</Badge>
      </div>

      <dl>
        <div className="flex items-center justify-between gap-3 py-1">
          <dt className="text-ink-soft">Tracking</dt>
          <dd className="flex min-w-0 items-center gap-1">
            <span className="truncate font-mono text-xs text-ink select-all">{s.trackingCode}</span>
            <button type="button" onClick={copy} className="shrink-0 rounded p-1 text-ink-faint hover:bg-black/5 hover:text-ink" aria-label="Copy tracking number" title="Copy">
              <Copy className="size-3.5" aria-hidden />
            </button>
          </dd>
        </div>
        {s.consignmentId !== s.trackingCode && (
          <div className="flex items-center justify-between gap-3 py-1">
            <dt className="text-ink-soft">Consignment</dt>
            <dd className="truncate font-mono text-xs text-ink select-all">{s.consignmentId}</dd>
          </div>
        )}
        <div className="flex items-baseline justify-between gap-3 py-1">
          <dt className="text-ink-soft">{s.state === 'DELIVERED' && s.codAmount > 0 ? 'Cash collected' : 'Cash to collect'}</dt>
          <dd className="tabular-nums">{s.codAmount > 0 ? <span className="font-semibold text-ink">{tk(s.codAmount)}</span> : <span className="text-ink-soft">Prepaid</span>}</dd>
        </div>
        {s.deliveryFee != null && (
          <div className="flex items-baseline justify-between gap-3 py-1">
            <dt className="text-ink-soft">Delivery fee</dt>
            <dd className="tabular-nums">{tk(s.deliveryFee)}</dd>
          </div>
        )}
        <div className="flex items-baseline justify-between gap-3 py-1">
          <dt className="text-ink-soft">Last update</dt>
          <dd className="text-right">
            {s.lastEventAt ? (
              <time suppressHydrationWarning title={dateTime(s.lastEventAt)}>
                {relative(s.lastEventAt)}
              </time>
            ) : (
              'None yet'
            )}
            {s.courierStatus && <span className="block text-xs text-ink-soft">Courier says: {statusLabel(s.courierStatus)}</span>}
          </dd>
        </div>
        {s.note && (
          <div className="flex items-baseline justify-between gap-3 py-1">
            <dt className="shrink-0 text-ink-soft">Rider note</dt>
            <dd className="min-w-0 text-right break-words text-ink">{s.note}</dd>
          </div>
        )}
      </dl>

      {problem && (
        <p className="flex items-start gap-2 rounded-md bg-marigold-tint px-3 py-2 text-ink">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-marigold-dark" aria-hidden />
          <span>{problem}</span>
        </p>
      )}

      {!test && !final && (
        <div>
          <Button variant="outline" size="sm" loading={busy === `sync-${s.id}`} onClick={sync}>
            {busy !== `sync-${s.id}` && <RefreshCw className="size-3.5" aria-hidden />} Refresh status
          </Button>
          {s.lastSyncAt && (
            <span className="ml-2 text-xs text-ink-soft">
              Checked <time suppressHydrationWarning>{relative(s.lastSyncAt)}</time>
            </span>
          )}
        </div>
      )}

      {test && !final && info?.testStatuses && (
        <div className="rounded-md border border-dashed border-line px-3 py-2.5">
          <p className="mb-2 text-xs font-semibold text-ink-soft">Move parcel (test)</p>
          <div className="flex flex-wrap gap-1.5">
            {info.testStatuses.map((t) => (
              <Button
                key={t.status}
                variant="outline"
                size="sm"
                loading={busy === `sim-${t.status}`}
                disabled={busy !== null && busy !== `sim-${t.status}`}
                onClick={() => run(`sim-${t.status}`, () => post(`/admin/shipments/${s.id}/simulate`, { status: t.status }), `Parcel moved: ${t.label}`)}
              >
                {t.label}
              </Button>
            ))}
          </div>
          <p className="mt-2 text-xs text-ink-soft">Delivered and Returned to sender also close the order.</p>
        </div>
      )}

      <div>
        <h3 className="mb-2 text-xs font-semibold text-ink-soft">Courier history</h3>
        {s.events.length === 0 ? (
          <p className="text-ink-soft">Updates from the courier will be listed here.</p>
        ) : (
          <ol className="space-y-2.5 border-l border-line pl-4">
            {s.events.map((e, idx) => (
              <li key={e.id} className="relative">
                <span
                  className={clsx('absolute top-1.5 -left-[21px] size-2 rounded-full ring-4 ring-white', idx === 0 ? 'bg-padma' : 'bg-[#c9cfcb]')}
                  aria-hidden
                />
                <p className="font-medium text-ink">{statusLabel(e.status)}</p>
                {e.message && <p className="text-ink-soft">{e.message}</p>}
                <p className="text-xs text-ink-faint">
                  <time suppressHydrationWarning>{dateTime(e.createdAt)}</time> · {SOURCE[e.source] ?? e.source}
                </p>
              </li>
            ))}
          </ol>
        )}
      </div>
    </article>
  );
}
