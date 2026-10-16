'use client';

import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { FormEvent, ReactNode, useState } from 'react';
import { Button, Field, Input } from '@/components/ui';
import { put } from '@/lib/api';
import { Switch } from './controls';
import { useAction } from './use-action';

export interface AppSettings {
  store: { name: string; tagline: string; supportPhone: string; supportEmail: string };
  delivery: { zones: Record<'INSIDE_DHAKA' | 'DHAKA_SUBURBS' | 'OUTSIDE_DHAKA', { fee: number; days: string }>; freeShippingThreshold: number };
  cod: { enabled: boolean; maxOrderTotal: number; callThreshold: number; advanceThreshold: number };
  coins: { checkInReward: number; orderRewardPercent: number; reviewReward: number; maxRedeemPercent: number };
  orders: { onlinePaymentExpiryMinutes: number; maxQtyPerItem: number };
  alerts: { smsEnabled: boolean; abandonedCartHours: number; abandonedCartMaxDays: number };
  support: { smsOnReply: boolean };
  returns: { windowDays: number; reasons: string[] };
}

const ZONES: { key: keyof AppSettings['delivery']['zones']; label: string; hint: string }[] = [
  { key: 'INSIDE_DHAKA', label: 'Inside Dhaka', hint: 'Dhaka city corporation areas' },
  { key: 'DHAKA_SUBURBS', label: 'Dhaka suburbs', hint: 'Gazipur, Narayanganj, Savar and nearby' },
  { key: 'OUTSIDE_DHAKA', label: 'Outside Dhaka', hint: 'All other districts' },
];

type Errors = Record<string, string>;

function Section({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section className="grid gap-4 border-b border-line px-4 py-5 last:border-b-0 md:grid-cols-[240px_minmax(0,1fr)] md:gap-8">
      <div>
        <h2 className="text-base font-semibold text-ink">{title}</h2>
        <p className="text-sm text-ink-soft">{description}</p>
      </div>
      <div className="min-w-0 space-y-4">{children}</div>
    </section>
  );
}

/** Number input that keeps the raw text while typing and reports a number. */
function NumberField({
  label,
  hint,
  value,
  onChange,
  error,
  suffix,
  prefix,
  min = 0,
  max,
}: {
  label: string;
  hint?: string;
  value: number;
  onChange: (n: number) => void;
  error?: string;
  suffix?: string;
  prefix?: string;
  min?: number;
  max?: number;
}) {
  return (
    <Field label={label} hint={hint} error={error}>
      <span className="relative flex items-center">
        {prefix && <span className="pointer-events-none absolute left-3 text-ink-soft">{prefix}</span>}
        <Input
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          step={1}
          value={Number.isNaN(value) ? '' : value}
          onChange={(e) => onChange(e.target.value === '' ? NaN : Number(e.target.value))}
          className={`tabular-nums ${prefix ? 'pl-7' : ''} ${suffix ? 'pr-16' : ''}`}
          aria-invalid={!!error}
        />
        {suffix && <span className="pointer-events-none absolute right-3 text-sm text-ink-soft">{suffix}</span>}
      </span>
    </Field>
  );
}

function validate(s: AppSettings): Errors {
  const e: Errors = {};
  const whole = (path: string, v: number, min = 0, max = Infinity, msg?: string) => {
    if (!Number.isInteger(v) || v < min || v > max) e[path] = msg ?? (max === Infinity ? `Enter a whole number, ${min} or more` : `Enter a whole number from ${min} to ${max}`);
  };
  if (!s.store.name.trim()) e['store.name'] = 'The store needs a name';
  if (s.store.supportEmail && !/^\S+@\S+\.\S+$/.test(s.store.supportEmail)) e['store.supportEmail'] = 'Enter a valid email address';
  for (const z of ZONES) {
    whole(`zone.${z.key}.fee`, s.delivery.zones[z.key].fee);
    if (!s.delivery.zones[z.key].days.trim()) e[`zone.${z.key}.days`] = 'Enter the delivery time, e.g. 1-2';
  }
  whole('delivery.free', s.delivery.freeShippingThreshold);
  whole('cod.max', s.cod.maxOrderTotal, 1);
  whole('cod.call', s.cod.callThreshold, 0, 100);
  whole('cod.advance', s.cod.advanceThreshold, 0, 100);
  if (!e['cod.call'] && !e['cod.advance'] && s.cod.advanceThreshold < s.cod.callThreshold) {
    e['cod.advance'] = 'Must be at or above the call threshold, or no order would ever need a call';
  }
  whole('coins.checkIn', s.coins.checkInReward);
  whole('coins.order', s.coins.orderRewardPercent, 0, 100);
  whole('coins.review', s.coins.reviewReward);
  whole('coins.redeem', s.coins.maxRedeemPercent, 0, 100);
  whole('orders.expiry', s.orders.onlinePaymentExpiryMinutes, 5, 1440);
  whole('orders.maxQty', s.orders.maxQtyPerItem, 1, 100);
  whole('alerts.cartHours', s.alerts.abandonedCartHours, 0, 168);
  whole('alerts.cartDays', s.alerts.abandonedCartMaxDays, 1, 30);
  if (!e['alerts.cartHours'] && !e['alerts.cartDays'] && s.alerts.abandonedCartHours >= s.alerts.abandonedCartMaxDays * 24) {
    e['alerts.cartHours'] = `Must be under ${s.alerts.abandonedCartMaxDays * 24} hours (the age limit below), or no cart would get a reminder`;
  }
  whole('returns.window', s.returns.windowDays, 0, 60);
  if (s.returns.reasons.filter((r) => r.trim()).length === 0) e['returns.reasons'] = 'Keep at least one reason for customers to choose';
  return e;
}

export function SettingsForm({ initial }: { initial: AppSettings }) {
  const { run, busy } = useAction();
  const [s, setS] = useState<AppSettings>(initial);
  const [saved, setSaved] = useState<AppSettings>(initial);
  const [errors, setErrors] = useState<Errors>({});
  const dirty = JSON.stringify(s) !== JSON.stringify(saved);

  const set = <K extends keyof AppSettings>(section: K, patch: Partial<AppSettings[K]>) => setS((cur) => ({ ...cur, [section]: { ...cur[section], ...patch } }));
  const setZone = (key: keyof AppSettings['delivery']['zones'], patch: Partial<{ fee: number; days: string }>) =>
    setS((cur) => ({ ...cur, delivery: { ...cur.delivery, zones: { ...cur.delivery.zones, [key]: { ...cur.delivery.zones[key], ...patch } } } }));
  const setReasons = (reasons: string[]) => set('returns', { reasons });

  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    const e = validate(s);
    setErrors(e);
    if (Object.keys(e).length) {
      document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
      return;
    }
    const clean: AppSettings = {
      ...s,
      store: { name: s.store.name.trim(), tagline: s.store.tagline.trim(), supportPhone: s.store.supportPhone.trim(), supportEmail: s.store.supportEmail.trim() },
      returns: { ...s.returns, reasons: s.returns.reasons.map((r) => r.trim()).filter(Boolean) },
    };
    // The API deep-merges, so send only the sections that changed; the audit log then names just those.
    const body = Object.fromEntries(
      (Object.keys(clean) as (keyof AppSettings)[]).filter((k) => JSON.stringify(clean[k]) !== JSON.stringify(saved[k])).map((k) => [k, clean[k]]),
    ) as Partial<AppSettings>;
    const next = await run('save', () => put<AppSettings>('/admin/settings', Object.keys(body).length ? body : clean), 'Settings saved');
    if (next) {
      setS(next);
      setSaved(next);
    }
  };

  const reasons = s.returns.reasons;

  return (
    <form onSubmit={submit} noValidate>
      <div className="rounded-[6px] border border-line bg-white">
        <Section title="Store" description="Shown in the header, emails and on packing slips.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Store name" error={errors['store.name']}>
              <Input value={s.store.name} onChange={(e) => set('store', { name: e.target.value })} maxLength={60} aria-invalid={!!errors['store.name']} />
            </Field>
            <Field label="Tagline">
              <Input value={s.store.tagline} onChange={(e) => set('store', { tagline: e.target.value })} maxLength={120} />
            </Field>
            <Field label="Support phone" hint="Printed on packing slips and the help page.">
              <Input value={s.store.supportPhone} onChange={(e) => set('store', { supportPhone: e.target.value })} inputMode="tel" maxLength={30} />
            </Field>
            <Field label="Support email" error={errors['store.supportEmail']}>
              <Input type="email" value={s.store.supportEmail} onChange={(e) => set('store', { supportEmail: e.target.value })} aria-invalid={!!errors['store.supportEmail']} />
            </Field>
          </div>
        </Section>

        <Section title="Delivery" description="Fee and promised delivery time for each zone. The zone comes from the customer's district.">
          <div className="space-y-3">
            {ZONES.map((z) => (
              <fieldset key={z.key} className="grid gap-3 rounded-md border border-line p-3 sm:grid-cols-[minmax(0,1fr)_140px_140px] sm:items-start">
                <legend className="sr-only">{z.label}</legend>
                <div className="sm:pt-6">
                  <p className="font-medium text-ink">{z.label}</p>
                  <p className="text-xs text-ink-soft">{z.hint}</p>
                </div>
                <NumberField label="Fee" prefix="৳" value={s.delivery.zones[z.key].fee} onChange={(fee) => setZone(z.key, { fee })} error={errors[`zone.${z.key}.fee`]} />
                <Field label="Days" error={errors[`zone.${z.key}.days`]}>
                  <Input value={s.delivery.zones[z.key].days} onChange={(e) => setZone(z.key, { days: e.target.value })} maxLength={10} placeholder="1-2" aria-invalid={!!errors[`zone.${z.key}.days`]} />
                </Field>
              </fieldset>
            ))}
          </div>
          <div className="max-w-xs">
            <NumberField
              label="Free delivery from"
              prefix="৳"
              hint="Orders with a subtotal at or above this ship free. Enter 0 to turn free delivery off."
              value={s.delivery.freeShippingThreshold}
              onChange={(v) => set('delivery', { freeShippingThreshold: v })}
              error={errors['delivery.free']}
            />
          </div>
        </Section>

        <Section title="Cash on delivery" description="Most orders in Bangladesh are cash on delivery. These rules limit parcels that come back unpaid.">
          <div>
            <Switch checked={s.cod.enabled} onChange={(enabled) => set('cod', { enabled })} label="Offer cash on delivery" />
            <p className="mt-1 text-xs text-ink-soft">When off, every customer must pay with bKash, Nagad or card.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <NumberField
              label="Largest cash order"
              prefix="৳"
              hint="Orders above this total must be paid online."
              value={s.cod.maxOrderTotal}
              onChange={(v) => set('cod', { maxOrderTotal: v })}
              error={errors['cod.max']}
              min={1}
            />
            <NumberField
              label="Call before confirming at"
              suffix="risk"
              hint="Orders scoring this or higher (0 to 100) wait in the To call queue until staff phone the customer."
              value={s.cod.callThreshold}
              onChange={(v) => set('cod', { callThreshold: v })}
              error={errors['cod.call']}
              max={100}
            />
            <NumberField
              label="Require advance payment at"
              suffix="risk"
              hint="At this score or higher, cash on delivery is not offered and the customer pays online."
              value={s.cod.advanceThreshold}
              onChange={(v) => set('cod', { advanceThreshold: v })}
              error={errors['cod.advance']}
              max={100}
            />
          </div>
          <p className="rounded-md bg-paper px-3 py-2 text-xs text-ink-soft">
            The risk score is worked out at checkout from the customer&apos;s and phone number&apos;s history: no past deliveries adds 20, each refused parcel adds 30, recent
            cancellations after confirming add 10 each, orders over ৳5,000 add 15, and every past delivery takes off 10.
          </p>
        </Section>

        <Section title="Coins" description="Loyalty coins customers earn and spend. 1 coin is worth ৳1.">
          <div className="grid gap-4 sm:grid-cols-2">
            <NumberField label="Daily check-in reward" suffix="coins" value={s.coins.checkInReward} onChange={(v) => set('coins', { checkInReward: v })} error={errors['coins.checkIn']} />
            <NumberField
              label="Order reward"
              suffix="% of total"
              hint="Credited when the order is delivered."
              value={s.coins.orderRewardPercent}
              onChange={(v) => set('coins', { orderRewardPercent: v })}
              error={errors['coins.order']}
              max={100}
            />
            <NumberField label="Review reward" suffix="coins" hint="For each product review." value={s.coins.reviewReward} onChange={(v) => set('coins', { reviewReward: v })} error={errors['coins.review']} />
            <NumberField
              label="Most an order can pay in coins"
              suffix="%"
              hint="Share of the subtotal after vouchers."
              value={s.coins.maxRedeemPercent}
              onChange={(v) => set('coins', { maxRedeemPercent: v })}
              error={errors['coins.redeem']}
              max={100}
            />
          </div>
        </Section>

        <Section title="Orders" description="Checkout limits.">
          <div className="grid gap-4 sm:grid-cols-2">
            <NumberField
              label="Online payment time limit"
              suffix="minutes"
              hint="Unpaid bKash, Nagad and card orders are cancelled after this and their stock is released."
              value={s.orders.onlinePaymentExpiryMinutes}
              onChange={(v) => set('orders', { onlinePaymentExpiryMinutes: v })}
              error={errors['orders.expiry']}
              min={5}
              max={1440}
            />
            <NumberField
              label="Most of one item per order"
              suffix="pieces"
              hint="Stops resellers clearing out deals."
              value={s.orders.maxQtyPerItem}
              onChange={(v) => set('orders', { maxQtyPerItem: v })}
              error={errors['orders.maxQty']}
              min={1}
              max={100}
            />
          </div>
        </Section>

        <Section title="Alerts and reminders" description="Messages that bring customers back: price drops, items back in stock and carts they left behind.">
          <div>
            <Switch checked={s.alerts.smsEnabled} onChange={(smsEnabled) => set('alerts', { smsEnabled })} label="Text customers about price drops, restocks and carts" />
            <p className="mt-1 text-xs text-ink-soft">
              Only customers who agreed to offers by text get these. When off, they still see the alerts in their notifications on the site.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <NumberField
              label="Remind about a cart after"
              suffix="hours"
              hint="Hours after the customer last touched their cart. Enter 0 to turn cart reminders off."
              value={s.alerts.abandonedCartHours}
              onChange={(v) => set('alerts', { abandonedCartHours: v })}
              error={errors['alerts.cartHours']}
              max={168}
            />
            <NumberField
              label="Skip carts older than"
              suffix="days"
              hint="Carts left longer than this get no reminder. Each cart is reminded once."
              value={s.alerts.abandonedCartMaxDays}
              onChange={(v) => set('alerts', { abandonedCartMaxDays: v })}
              error={errors['alerts.cartDays']}
              min={1}
              max={30}
            />
          </div>
        </Section>

        <Section title="Support" description="Support tickets customers open from their account.">
          <div>
            <Switch checked={s.support.smsOnReply} onChange={(smsOnReply) => set('support', { smsOnReply })} label="Text the customer when staff reply" />
            <p className="mt-1 text-xs text-ink-soft">The message says there is a reply and links to the ticket. The reply itself stays on the site.</p>
          </div>
        </Section>

        <Section title="Returns" description="Products can set their own return days; this is the default window shown to customers.">
          <div className="max-w-xs">
            <NumberField
              label="Return window"
              suffix="days"
              hint="Days after delivery. Enter 0 for no returns."
              value={s.returns.windowDays}
              onChange={(v) => set('returns', { windowDays: v })}
              error={errors['returns.window']}
              max={60}
            />
          </div>
          <fieldset>
            <legend className="mb-1 text-sm font-medium text-ink">Reasons customers can pick</legend>
            <ul className="space-y-2">
              {reasons.map((r, i) => (
                <li key={i} className="flex items-center gap-1.5">
                  <Input
                    value={r}
                    onChange={(e) => setReasons(reasons.map((x, j) => (j === i ? e.target.value : x)))}
                    maxLength={80}
                    aria-label={`Reason ${i + 1}`}
                    className="flex-1"
                  />
                  <Button type="button" variant="ghost" size="sm" className="px-2" aria-label={`Move reason ${i + 1} up`} disabled={i === 0} onClick={() => setReasons(swap(reasons, i, i - 1))}>
                    <ArrowUp className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="px-2"
                    aria-label={`Move reason ${i + 1} down`}
                    disabled={i === reasons.length - 1}
                    onClick={() => setReasons(swap(reasons, i, i + 1))}
                  >
                    <ArrowDown className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="px-2 hover:text-sindoor"
                    aria-label={`Remove reason ${i + 1}`}
                    onClick={() => setReasons(reasons.filter((_, j) => j !== i))}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
            {errors['returns.reasons'] && <p className="mt-1 text-sm text-sindoor">{errors['returns.reasons']}</p>}
            <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => setReasons([...reasons, ''])} disabled={reasons.length >= 12}>
              <Plus className="size-4" /> Add reason
            </Button>
          </fieldset>
        </Section>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-white/95 px-4 py-3 backdrop-blur lg:left-60">
        <div className="mx-auto flex max-w-[1400px] items-center justify-end gap-3 lg:px-4">
          <span className="mr-auto text-sm text-ink-soft" aria-live="polite">
            {Object.keys(errors).length ? (
              <span className="text-sindoor">Fix the highlighted fields</span>
            ) : (
              <span className="hidden sm:inline">{dirty ? 'You have unsaved changes' : 'All changes saved'}</span>
            )}
          </span>
          <Button
            type="button"
            variant="outline"
            disabled={!dirty || busy === 'save'}
            onClick={() => {
              setS(saved);
              setErrors({});
            }}
          >
            Discard changes
          </Button>
          <Button type="submit" loading={busy === 'save'} disabled={!dirty}>
            Save settings
          </Button>
        </div>
      </div>
    </form>
  );
}

function swap<T>(list: T[], a: number, b: number): T[] {
  const out = [...list];
  [out[a], out[b]] = [out[b], out[a]];
  return out;
}
