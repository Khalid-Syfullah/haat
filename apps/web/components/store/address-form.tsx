'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { api, ApiError, patch, post } from '@/lib/api';
import type { Address, Locations } from '@/lib/types';
import { useToast } from '../providers';
import { Button, Field, Input, Select, Textarea } from '../ui';

let cachedLocations: Promise<Locations> | null = null;
export function useLocations() {
  const [loc, setLoc] = useState<Locations | null>(null);
  useEffect(() => {
    cachedLocations ??= api<Locations>('/locations');
    cachedLocations.then(setLoc).catch(() => (cachedLocations = null));
  }, []);
  return loc;
}

export function AddressForm({ address, defaultName, defaultPhone, onSaved }: { address?: Address; defaultName?: string; defaultPhone?: string; onSaved: (a: Address) => void }) {
  const loc = useLocations();
  const toast = useToast();
  const [form, setForm] = useState({
    fullName: address?.fullName ?? defaultName ?? '',
    phone: address?.phone ?? defaultPhone ?? '',
    division: address?.division ?? 'Dhaka',
    district: address?.district ?? 'Dhaka',
    area: address?.area ?? '',
    line: address?.line ?? '',
    label: address?.label ?? 'Home',
    isDefault: address?.isDefault ?? false,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof form, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  const districts = useMemo(() => loc?.divisions.find((d) => d.name === form.division)?.districts ?? [], [loc, form.division]);
  const zone = loc?.zones.find((z) => z.zone === districts.find((d) => d.name === form.district)?.zone);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const saved = address ? await patch<Address>(`/account/addresses/${address.id}`, form) : await post<Address>('/account/addresses', form);
      toast(address ? 'Address updated' : 'Address saved');
      onSaved(saved);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save the address');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Full name">
          <Input value={form.fullName} onChange={(e) => set('fullName', e.target.value)} required minLength={2} autoComplete="name" />
        </Field>
        <Field label="Mobile number" hint="The courier will call this number">
          <Input value={form.phone} onChange={(e) => set('phone', e.target.value)} required inputMode="tel" placeholder="01XXXXXXXXX" autoComplete="tel" />
        </Field>
        <Field label="Division">
          <Select
            value={form.division}
            onChange={(e) => {
              const div = loc?.divisions.find((d) => d.name === e.target.value);
              setForm((f) => ({ ...f, division: e.target.value, district: div?.districts[0]?.name ?? '', area: '' }));
            }}
          >
            {(loc?.divisions ?? [{ name: form.division, nameBn: '', districts: [] }]).map((d) => (
              <option key={d.name} value={d.name}>
                {d.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="District" hint={zone ? `${zone.label}: ৳${zone.fee} delivery, ${zone.days} days` : undefined}>
          <Select value={form.district} onChange={(e) => setForm((f) => ({ ...f, district: e.target.value, area: '' }))}>
            {(districts.length ? districts : [{ name: form.district }]).map((d) => (
              <option key={d.name} value={d.name}>
                {d.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={form.district === 'Dhaka' ? 'Area' : 'Area or upazila'} className="sm:col-span-2">
          {form.district === 'Dhaka' && loc ? (
            <Select value={form.area} onChange={(e) => set('area', e.target.value)} required>
              <option value="">Choose your area</option>
              {loc.dhakaAreas.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </Select>
          ) : (
            <Input value={form.area} onChange={(e) => set('area', e.target.value)} required minLength={2} placeholder="e.g. Sadar, Agrabad" />
          )}
        </Field>
        <Field label="House, road and landmark" className="sm:col-span-2">
          <Textarea value={form.line} onChange={(e) => set('line', e.target.value)} required minLength={4} rows={2} className="min-h-16!" placeholder="House 12, Road 5, near the mosque" autoComplete="street-address" />
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex gap-2" role="radiogroup" aria-label="Address label">
          {['Home', 'Office'].map((l) => (
            <button
              key={l}
              type="button"
              role="radio"
              aria-checked={form.label === l}
              onClick={() => set('label', l)}
              className={form.label === l ? 'rounded-full border border-padma bg-padma-tint px-3 py-1 text-sm font-semibold text-padma-dark' : 'rounded-full border border-line px-3 py-1 text-sm'}
            >
              {l}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="size-4 accent-padma" checked={form.isDefault} onChange={(e) => set('isDefault', e.target.checked)} />
          Make this my default address
        </label>
      </div>
      {error && <p className="text-sm text-sindoor">{error}</p>}
      <Button type="submit" loading={busy} block>
        Save address
      </Button>
    </form>
  );
}
