'use client';

import { Search } from 'lucide-react';
import { FormEvent, ReactNode, useEffect, useMemo, useState } from 'react';
import { useToast } from '@/components/providers';
import { Badge, Button, clsx, Field, Input, Modal, Select, Spinner, Textarea } from '@/components/ui';
import { api, ApiError, post } from '@/lib/api';
import { tk } from '@/lib/format';
import type { AdminShipment, CourierCode, CourierLocation, CourierOption } from './types';
import { useAction } from './use-action';

/** What the booking dialog needs to know about the order. */
export interface BookingOrder {
  id: string;
  orderNo: string;
  shipName: string;
  shipPhone: string;
  shipLine: string;
  shipArea: string;
  shipDistrict: string;
  total: number;
  paymentStatus: string;
  note: string | null;
}

const HINT: Record<CourierCode, string> = {
  steadfast: 'Books with the address as written',
  pathao: 'You can pick the city and area',
  redx: 'You pick the delivery area',
  test: 'Made-up tracking number for practice',
};

export function courierTitle(c: Pick<CourierOption, 'name' | 'test'>) {
  return c.test ? 'Test courier (not real)' : c.name;
}

/** Loads one list of courier destinations. `path` null means nothing to load yet. */
function useLocations(path: string | null) {
  const [state, setState] = useState<{ path: string | null; items: CourierLocation[] | null; error: string | null }>({ path: null, items: null, error: null });
  useEffect(() => {
    if (!path) return;
    let live = true;
    api<CourierLocation[]>(path)
      .then((items) => live && setState({ path, items, error: null }))
      .catch((e) => live && setState({ path, items: null, error: e instanceof ApiError ? e.message : 'Could not load areas from the courier. Try again.' }));
    return () => {
      live = false;
    };
  }, [path]);
  const current = path !== null && state.path === path;
  return { items: current ? state.items : null, error: current ? state.error : null, loading: path !== null && !current };
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9ঀ-৿]+/g, '');

/** Closest name in the list: exact, then starts with, then contains. */
function bestMatch(items: CourierLocation[] | null, ...names: string[]): string {
  if (!items?.length) return '';
  for (const raw of names) {
    const n = norm(raw);
    if (!n) continue;
    const hit =
      items.find((i) => norm(i.name) === n) ??
      items.find((i) => norm(i.name).startsWith(n) || n.startsWith(norm(i.name))) ??
      items.find((i) => norm(i.name).includes(n));
    if (hit) return String(hit.id);
  }
  return '';
}

export function CourierBooking({ order, couriers, onClose }: { order: BookingOrder; couriers: CourierOption[] | null; onClose: () => void }) {
  const { run, busy } = useAction();
  const toast = useToast();
  const usable = (couriers ?? []).filter((c) => c.configured);
  const [code, setCode] = useState<CourierCode | ''>((usable.find((c) => !c.test) ?? usable[0])?.code ?? '');
  const [weight, setWeight] = useState('');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<{ weight?: string; area?: string }>({});

  const courier = couriers?.find((c) => c.code === code) ?? null;
  const kind = courier?.configured ? courier.locationKind : null;

  // Pathao: city → zone → area, all optional. `null` choice = use the best match for the address.
  const [cityChoice, setCityChoice] = useState<string | null>(null);
  const [zoneChoice, setZoneChoice] = useState<string | null>(null);
  const [pAreaChoice, setPAreaChoice] = useState<string | null>(null);
  const cities = useLocations(kind === 'pathao' ? '/admin/couriers/pathao/locations?kind=city' : null);
  const cityId = cityChoice ?? bestMatch(cities.items, order.shipDistrict);
  const zones = useLocations(kind === 'pathao' && cityId ? `/admin/couriers/pathao/locations?kind=zone&parentId=${cityId}` : null);
  const zoneId = zoneChoice ?? bestMatch(zones.items, order.shipArea);
  const pAreas = useLocations(kind === 'pathao' && zoneId ? `/admin/couriers/pathao/locations?kind=area&parentId=${zoneId}` : null);
  const pAreaId = pAreaChoice ?? '';

  // RedX: one required area within the order's district.
  const [rAreaChoice, setRAreaChoice] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const rAreas = useLocations(kind === 'redx' ? `/admin/couriers/redx/locations?kind=area&district=${encodeURIComponent(order.shipDistrict)}` : null);
  const rAreaId = rAreaChoice ?? bestMatch(rAreas.items, order.shipArea);
  const rFiltered = useMemo(() => {
    const items = rAreas.items ?? [];
    const f = norm(filter);
    const list = f ? items.filter((i) => norm(i.name).includes(f)) : items;
    // Keep the chosen area in the list so the select never shows a value it doesn't have.
    const chosen = items.find((i) => String(i.id) === rAreaId);
    return chosen && !list.includes(chosen) ? [chosen, ...list] : list;
  }, [rAreas.items, filter, rAreaId]);

  const prepaid = order.paymentStatus === 'PAID';
  const address = `${order.shipLine}, ${order.shipArea}, ${order.shipDistrict}`;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!courier) return;
    const errs: typeof errors = {};
    const w = weight.trim() === '' ? undefined : Number(weight);
    if (w !== undefined && (!Number.isInteger(w) || w < 50 || w > 50000)) errs.weight = 'Enter whole grams between 50 and 50,000';
    if (kind === 'redx' && !rAreaId) errs.area = 'Pick the delivery area';
    setErrors(errs);
    if (Object.keys(errs).length) return;

    let location: Record<string, number | string> | undefined;
    if (kind === 'pathao') {
      location = {};
      if (cityId) location.cityId = Number(cityId);
      if (cityId && zoneId) location.zoneId = Number(zoneId);
      if (cityId && zoneId && pAreaId) location.areaId = Number(pAreaId);
      if (!Object.keys(location).length) location = undefined;
    } else if (kind === 'redx') {
      const area = rAreas.items?.find((i) => String(i.id) === rAreaId);
      if (area) location = { areaId: area.id, areaName: area.name };
    }

    const shipment = await run('book', () =>
      post<AdminShipment>(`/admin/orders/${order.id}/shipments`, {
        courier: courier.code,
        ...(note.trim() ? { note: note.trim() } : {}),
        ...(w !== undefined ? { weightGrams: w } : {}),
        ...(location ? { location } : {}),
      }),
    );
    if (shipment) {
      toast(`Booked with ${courier.name}: ${shipment.trackingCode}`);
      onClose();
    }
  };

  return (
    <Modal open onClose={onClose} title={`Book a courier for ${order.orderNo}`} wide>
      {!couriers ? (
        <div className="space-y-4">
          <p className="text-sindoor">Could not load the list of couriers. Close this and refresh the page.</p>
          <div className="flex justify-end">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-5" noValidate>
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-ink">Courier</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {couriers.map((c) => {
                const on = c.code === code;
                return (
                  <label
                    key={c.code}
                    className={clsx(
                      'flex items-start gap-3 rounded-md border px-3 py-2.5 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-marigold',
                      !c.configured ? 'cursor-not-allowed border-line bg-paper opacity-70' : on ? 'cursor-pointer border-padma bg-padma-tint' : 'cursor-pointer border-line hover:border-ink-faint',
                    )}
                  >
                    <input
                      type="radio"
                      name="courier"
                      value={c.code}
                      checked={on}
                      disabled={!c.configured}
                      onChange={() => {
                        setCode(c.code);
                        setErrors({});
                      }}
                      className="mt-1 size-4 shrink-0 accent-padma"
                    />
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className={clsx('font-semibold', c.configured ? 'text-ink' : 'text-ink-soft')}>{courierTitle(c)}</span>
                        {!c.configured && <Badge>Not set up</Badge>}
                      </span>
                      <span className="block text-xs text-ink-soft">{c.configured ? HINT[c.code] : 'Its account keys are not added yet'}</span>
                    </span>
                  </label>
                );
              })}
            </div>
            {usable.length === 0 && <p className="mt-2 text-sm text-sindoor">No courier is set up yet. Use &quot;Ship without booking&quot; for now.</p>}
          </fieldset>

          {kind === 'pathao' && (
            <fieldset className="space-y-3">
              <legend className="mb-1 text-sm font-medium text-ink">Destination at Pathao</legend>
              <p className="text-xs text-ink-soft">Optional. Pathao works out anything you leave as &quot;Not sure&quot; from the address.</p>
              <div className="grid gap-3 sm:grid-cols-3">
                <LocationSelect
                  label="City"
                  list={cities}
                  value={cityId}
                  onChange={(v) => {
                    setCityChoice(v);
                    setZoneChoice(null);
                    setPAreaChoice(null);
                  }}
                />
                <LocationSelect
                  label="Zone"
                  list={zones}
                  value={zoneId}
                  disabled={!cityId}
                  onChange={(v) => {
                    setZoneChoice(v);
                    setPAreaChoice(null);
                  }}
                />
                <LocationSelect label="Area" list={pAreas} value={pAreaId} disabled={!zoneId} onChange={setPAreaChoice} />
              </div>
            </fieldset>
          )}

          {kind === 'redx' && (
            <fieldset className="space-y-2">
              <legend className="mb-1 text-sm font-medium text-ink">Delivery area at RedX</legend>
              {rAreas.loading ? (
                <p className="flex items-center gap-2 text-sm text-ink-soft">
                  <Spinner className="size-4" /> Loading areas in {order.shipDistrict}
                </p>
              ) : rAreas.error ? (
                <p className="text-sm text-sindoor">{rAreas.error}</p>
              ) : !rAreas.items?.length ? (
                <p className="text-sm text-sindoor">RedX has no areas listed for {order.shipDistrict}. Ship this order another way.</p>
              ) : (
                <>
                  <div className="relative">
                    <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-faint" aria-hidden />
                    <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter areas" aria-label="Filter areas" className="pl-9" />
                  </div>
                  <Field
                    label="Area"
                    error={errors.area}
                    hint={filter ? `Showing ${rFiltered.length} of ${rAreas.items.length} areas` : `${rAreas.items.length} areas in ${order.shipDistrict}`}
                  >
                    <Select
                      value={rAreaId}
                      onChange={(e) => {
                        setRAreaChoice(e.target.value);
                        setErrors((x) => ({ ...x, area: undefined }));
                      }}
                      aria-invalid={!!errors.area}
                    >
                      <option value="">Pick an area</option>
                      {rFiltered.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </>
              )}
            </fieldset>
          )}

          <section className="rounded-md bg-paper px-4 py-3" aria-labelledby="booking-sent">
            <h3 id="booking-sent" className="mb-1 text-sm font-semibold text-ink">
              What the courier gets
            </h3>
            <dl className="text-sm">
              <SentRow label="Name">{order.shipName}</SentRow>
              <SentRow label="Phone">
                <span className="tabular-nums">{order.shipPhone}</span>
              </SentRow>
              <SentRow label="Address">{address}</SentRow>
              <SentRow label="Cash to collect">
                {prepaid ? <span className="text-ink-soft">Prepaid: nothing to collect</span> : <span className="font-semibold tabular-nums">{tk(order.total)}</span>}
              </SentRow>
            </dl>
          </section>

          <div className="grid gap-4 sm:grid-cols-[150px_minmax(0,1fr)]">
            <Field label="Weight (g)" error={errors.weight} hint={errors.weight ? undefined : 'Empty uses the product weights'}>
              <Input
                type="number"
                inputMode="numeric"
                min={50}
                max={50000}
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                aria-invalid={!!errors.weight}
                placeholder="Optional"
              />
            </Field>
            <Field label="Note for the rider" hint={order.note ? "Empty sends the customer's own note." : 'Optional, for example "Call before coming".'}>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={250} className="min-h-10" rows={2} />
            </Field>
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Close
            </Button>
            <Button type="submit" loading={busy === 'book'} disabled={!courier?.configured || (kind === 'redx' && !rAreas.items?.length)}>
              {courier ? `Book with ${courier.test ? 'test courier' : courier.name}` : 'Book courier'}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

function SentRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[110px_minmax(0,1fr)] gap-3 py-0.5">
      <dt className="text-ink-soft">{label}</dt>
      <dd className="min-w-0 break-words text-ink">{children}</dd>
    </div>
  );
}

function LocationSelect({
  label,
  list,
  value,
  onChange,
  disabled,
}: {
  label: string;
  list: { items: CourierLocation[] | null; error: string | null; loading: boolean };
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <Field label={label} error={list.error}>
      <Select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled || list.loading || !!list.error}>
        <option value="">{list.loading ? 'Loading…' : 'Not sure'}</option>
        {(list.items ?? []).map((i) => (
          <option key={i.id} value={i.id}>
            {i.name}
          </option>
        ))}
      </Select>
    </Field>
  );
}
