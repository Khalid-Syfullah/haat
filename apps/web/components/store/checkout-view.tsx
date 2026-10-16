'use client';

import clsx from 'clsx';
import { Banknote, Coins, CreditCard, MapPin, PhoneCall, Ticket, Truck, Wallet } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { ApiError, post } from '@/lib/api';
import { date, tk, voucherValue } from '@/lib/format';
import type { Address } from '@/lib/types';
import { useSession, useToast } from '../providers';
import { Button, Input, Modal, Spinner, Textarea } from '../ui';
import { AddressForm } from './address-form';

type Method = 'COD' | 'BKASH' | 'NAGAD' | 'CARD';

interface Quote {
  lines: { variantId: string; slug: string; title: string; variantLabel: string | null; image: string | null; unitPrice: number; originalPrice: number; quantity: number; lineTotal: number; flashSaleItemId: string | null; issue: string | null }[];
  errors: string[];
  address: Address | null;
  delivery: { zone: string; label: string; days: string; fee: number } | null;
  subtotal: number;
  savings: number;
  shippingFee: number;
  shippingDiscount: number;
  discount: number;
  voucher: { code: string; title: string; discount: number; shippingDiscount: number; error: string | null } | null;
  coins: { balance: number; usable: number; used: number; maxPercent: number };
  total: number;
  freeShippingThreshold: number;
  payment: { codAllowed: boolean; codReason: string | null; needsCall: boolean; riskScore: number };
  availableVouchers: { code: string; title: string; type: string; value: number; maxDiscount: number | null; minSpend: number; endsAt: string; eligible: boolean }[];
}

const METHODS: { id: Method; label: string; note: string; icon: typeof Banknote; color?: string }[] = [
  { id: 'COD', label: 'Cash on delivery', note: 'Pay the rider when your order arrives', icon: Banknote },
  { id: 'BKASH', label: 'bKash', note: 'Pay from your bKash account', icon: Wallet, color: '#e2136e' },
  { id: 'NAGAD', label: 'Nagad', note: 'Pay from your Nagad account', icon: Wallet, color: '#ec1c24' },
  { id: 'CARD', label: 'Card', note: 'Visa, Mastercard or Amex', icon: CreditCard },
];

export function CheckoutView({ addresses: initialAddresses, buyNow, user }: { addresses: Address[]; buyNow: { variantId: string; quantity: number } | null; user: { name: string; phone: string } }) {
  const router = useRouter();
  const toast = useToast();
  const { refresh } = useSession();
  const [addresses, setAddresses] = useState(initialAddresses);
  const [addressId, setAddressId] = useState(initialAddresses.find((a) => a.isDefault)?.id ?? initialAddresses[0]?.id);
  const [voucherInput, setVoucherInput] = useState('');
  const [voucherCode, setVoucherCode] = useState<string | undefined>();
  const [useCoins, setUseCoins] = useState(false);
  const [method, setMethod] = useState<Method>('COD');
  const [note, setNote] = useState('');
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);
  const [addressModal, setAddressModal] = useState<'pick' | 'new' | null>(initialAddresses.length ? null : 'new');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = await post<Quote>('/checkout/quote', { addressId, voucherCode, useCoins, buyNow: buyNow ?? undefined });
      setQuote(q);
      if (!q.payment.codAllowed) setMethod((m) => (m === 'COD' ? 'BKASH' : m));
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Could not load checkout', 'error');
    } finally {
      setLoading(false);
    }
  }, [addressId, voucherCode, useCoins, buyNow, toast]);

  useEffect(() => {
    load();
  }, [load]);

  function applyVoucher(e?: FormEvent, code?: string) {
    e?.preventDefault();
    const c = (code ?? voucherInput).trim().toUpperCase();
    if (!c) return;
    setVoucherInput(c);
    setVoucherCode(c);
  }

  async function place() {
    if (!quote || !addressId) return;
    setPlacing(true);
    try {
      const appliedVoucher = quote.voucher && !quote.voucher.error ? quote.voucher.code : undefined;
      const res = await post<{ orderNo: string; next: 'pay' | 'done' }>('/checkout/place', {
        addressId,
        paymentMethod: method,
        voucherCode: appliedVoucher,
        useCoins,
        note: note.trim() || undefined,
        buyNow: buyNow ?? undefined,
      });
      await refresh();
      if (res.next === 'pay') {
        const pay = await post<{ redirectUrl: string }>(`/payments/${res.orderNo}/initiate`, {}, { 'idempotency-key': crypto.randomUUID() });
        window.location.href = pay.redirectUrl;
        return;
      }
      router.push(`/account/orders/${res.orderNo}?placed=1`);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Could not place your order', 'error');
      setPlacing(false);
      load();
    }
  }

  if (!quote) {
    return (
      <div className="flex justify-center py-24">
        <Spinner className="size-8" />
      </div>
    );
  }

  const address = quote.address;
  const blocking = quote.errors.filter((e) => !e.includes('address'));
  const codBlocked = !quote.payment.codAllowed;
  const totalShipping = quote.shippingFee - quote.shippingDiscount;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px] lg:items-start">
      <div className="space-y-4">
        {/* Address */}
        <section className="rounded-[var(--radius-card)] border border-line bg-white p-4" aria-labelledby="ship-title">
          <div className="mb-2 flex items-center justify-between">
            <h2 id="ship-title" className="flex items-center gap-2 font-semibold">
              <MapPin className="size-5 text-padma" /> Delivery address
            </h2>
            {address && (
              <button className="text-sm font-semibold text-padma hover:underline" onClick={() => setAddressModal('pick')}>
                Change
              </button>
            )}
          </div>
          {address ? (
            <div className="text-[15px]">
              <p className="font-semibold">
                {address.fullName} <span className="font-normal text-ink-soft">{address.phone}</span>
                <span className="ml-2 rounded bg-black/5 px-1.5 py-0.5 text-xs font-semibold text-ink-soft">{address.label}</span>
              </p>
              <p className="text-ink-soft">
                {address.line}, {address.area}, {address.district}, {address.division}
              </p>
            </div>
          ) : (
            <Button variant="secondary" onClick={() => setAddressModal('new')}>
              Add a delivery address
            </Button>
          )}
        </section>

        {/* Items */}
        <section className="rounded-[var(--radius-card)] border border-line bg-white p-4" aria-labelledby="items-title">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h2 id="items-title" className="font-semibold">
              Items ({quote.lines.reduce((s, l) => s + l.quantity, 0)})
            </h2>
            {quote.delivery && (
              <p className="flex items-center gap-1.5 text-sm text-ink-soft">
                <Truck className="size-4 text-padma" /> {quote.delivery.label}, arrives in {quote.delivery.days} days
              </p>
            )}
          </div>
          <ul className="divide-y divide-line">
            {quote.lines.map((l) => (
              <li key={l.variantId} className="flex gap-3 py-3">
                <div className="size-16 shrink-0 overflow-hidden rounded bg-paper">
                  {l.image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={l.image} alt="" className="size-full object-cover" />
                  )}
                </div>
                <div className="min-w-0 flex-1 text-[15px]">
                  <Link href={`/product/${l.slug}`} className="line-clamp-1 hover:text-padma">
                    {l.title}
                  </Link>
                  <p className="text-sm text-ink-soft">
                    {l.variantLabel ? `${l.variantLabel}, ` : ''}qty {l.quantity}
                    {l.flashSaleItemId && <span className="ml-2 font-semibold text-marigold-dark">Flash price</span>}
                  </p>
                  {l.issue && <p className="text-sm font-medium text-sindoor">{l.issue}</p>}
                </div>
                <div className="text-right">
                  <p className="font-semibold">{tk(l.lineTotal)}</p>
                  {l.originalPrice > l.unitPrice && <p className="text-xs text-ink-faint line-through">{tk(l.originalPrice * l.quantity)}</p>}
                </div>
              </li>
            ))}
          </ul>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note for the delivery rider (optional)" className="mt-2 min-h-11!" rows={1} maxLength={300} aria-label="Delivery note" />
        </section>

        {/* Payment */}
        <section className="rounded-[var(--radius-card)] border border-line bg-white p-4" aria-labelledby="pay-title">
          <h2 id="pay-title" className="mb-3 font-semibold">
            Payment method
          </h2>
          <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-labelledby="pay-title">
            {METHODS.map((m) => {
              const disabled = m.id === 'COD' && codBlocked;
              const on = method === m.id && !disabled;
              return (
                <button
                  key={m.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  disabled={disabled}
                  onClick={() => setMethod(m.id)}
                  className={clsx(
                    'flex items-start gap-3 rounded-md border-2 p-3 text-left transition-colors',
                    on ? 'border-padma bg-padma-tint/50' : 'border-line hover:border-ink-faint',
                    disabled && 'cursor-not-allowed opacity-55',
                  )}
                >
                  <span className={clsx('mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2', on ? 'border-padma' : 'border-ink-faint')}>
                    {on && <span className="size-2.5 rounded-full bg-padma" />}
                  </span>
                  <span>
                    <span className="flex items-center gap-1.5 font-semibold" style={m.color ? { color: m.color } : undefined}>
                      <m.icon className="size-4" /> {m.label}
                    </span>
                    <span className="block text-sm text-ink-soft">{disabled ? quote.payment.codReason : m.note}</span>
                  </span>
                </button>
              );
            })}
          </div>
          {method === 'COD' && quote.payment.needsCall && (
            <p className="mt-3 flex items-start gap-2 rounded-md bg-marigold-tint px-3 py-2 text-sm">
              <PhoneCall className="mt-0.5 size-4 shrink-0 text-marigold-dark" />
              We'll call {address?.phone} to confirm this order before packing it.
            </p>
          )}
          {method !== 'COD' && <p className="mt-3 text-sm text-ink-soft">You'll finish paying on a secure payment page. Unpaid orders are cancelled after 30 minutes.</p>}
        </section>
      </div>

      {/* Summary */}
      <aside className="space-y-3 lg:sticky lg:top-36">
        <section className="rounded-[var(--radius-card)] border border-line bg-white p-4" aria-labelledby="promo-title">
          <h2 id="promo-title" className="mb-2 flex items-center gap-2 font-semibold">
            <Ticket className="size-5 text-marigold-dark" /> Voucher
          </h2>
          <form onSubmit={applyVoucher} className="flex gap-2">
            <Input value={voucherInput} onChange={(e) => setVoucherInput(e.target.value.toUpperCase())} placeholder="Enter code" aria-label="Voucher code" className="uppercase" />
            <Button type="submit" variant="secondary" disabled={!voucherInput.trim()}>
              Apply
            </Button>
          </form>
          {quote.voucher && (
            <p className={clsx('mt-2 text-sm', quote.voucher.error ? 'text-sindoor' : 'text-padma')}>
              {quote.voucher.error ? quote.voucher.error : `${quote.voucher.code} applied: ${quote.voucher.title}`}
              <button
                className="ml-2 font-semibold text-ink-soft underline"
                onClick={() => {
                  setVoucherCode(undefined);
                  setVoucherInput('');
                }}
              >
                Remove
              </button>
            </p>
          )}
          {quote.availableVouchers.length > 0 && (
            <div className="mt-3 space-y-2">
              <p className="text-sm text-ink-soft">Your collected vouchers</p>
              {quote.availableVouchers.map((v) => (
                <button
                  key={v.code}
                  disabled={!v.eligible}
                  onClick={() => applyVoucher(undefined, v.code)}
                  className={clsx('ticket flex w-full items-center text-left text-sm disabled:opacity-60', quote.voucher?.code === v.code && !quote.voucher.error && 'ring-2 ring-padma')}
                >
                  <span className="flex-1 px-3 py-2">
                    <span className="block font-bold text-marigold-dark">
                      {voucherValue(v)}
                      {v.maxDiscount ? `, up to ${tk(v.maxDiscount)}` : ''}
                    </span>
                    <span className="block text-xs text-ink-soft">
                      {v.eligible ? `Code ${v.code}, valid till ${date(v.endsAt)}` : `Spend ${tk(v.minSpend - quote.subtotal)} more to use`}
                    </span>
                  </span>
                  <span className="ticket-divider self-stretch" />
                  <span className="px-3 font-semibold text-padma">{quote.voucher?.code === v.code && !quote.voucher.error ? 'Applied' : 'Use'}</span>
                </button>
              ))}
            </div>
          )}
        </section>

        {quote.coins.balance > 0 && (
          <label className="flex cursor-pointer items-center gap-3 rounded-[var(--radius-card)] border border-line bg-white p-4">
            <Coins className="size-5 shrink-0 text-marigold-dark" />
            <span className="flex-1 text-[15px]">
              <span className="block font-semibold">Use {quote.coins.usable} coins</span>
              <span className="block text-sm text-ink-soft">
                You have {quote.coins.balance}. Coins can pay up to {quote.coins.maxPercent}% of an order.
              </span>
            </span>
            <input type="checkbox" className="size-5 accent-padma" checked={useCoins} disabled={quote.coins.usable === 0} onChange={(e) => setUseCoins(e.target.checked)} />
          </label>
        )}

        <section className="rounded-[var(--radius-card)] border border-line bg-white p-4" aria-labelledby="sum-title">
          <h2 id="sum-title" className="mb-3 font-semibold">
            Order summary
          </h2>
          <dl className={clsx('space-y-2 text-[15px] transition-opacity', loading && 'opacity-60')}>
            <Row label="Items subtotal" value={tk(quote.subtotal)} />
            <Row label="Delivery fee" value={quote.delivery ? tk(quote.shippingFee) : 'Add an address'} />
            {quote.shippingDiscount > 0 && <Row label="Delivery discount" value={`-${tk(quote.shippingDiscount)}`} good />}
            {quote.discount > 0 && <Row label="Voucher" value={`-${tk(quote.discount)}`} good />}
            {quote.coins.used > 0 && <Row label="Coins" value={`-${tk(quote.coins.used)}`} good />}
            <div className="flex items-baseline justify-between border-t border-line pt-3">
              <dt className="font-semibold">Total</dt>
              <dd className="text-2xl font-bold text-sindoor">{tk(quote.total)}</dd>
            </div>
            {quote.savings + quote.discount + quote.shippingDiscount + quote.coins.used > 0 && (
              <p className="text-right text-sm text-padma">You save {tk(quote.savings + quote.discount + quote.shippingDiscount + quote.coins.used)} on this order</p>
            )}
            {totalShipping > 0 && quote.subtotal < quote.freeShippingThreshold && (
              <p className="text-right text-xs text-ink-faint">Free delivery from {tk(quote.freeShippingThreshold)}</p>
            )}
          </dl>
          {blocking.length > 0 && (
            <ul className="mt-3 space-y-1 rounded-md bg-sindoor-tint px-3 py-2 text-sm text-sindoor">
              {blocking.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
          <Button size="lg" block className="mt-4" onClick={place} loading={placing} disabled={loading || !address || blocking.length > 0 || (method === 'COD' && codBlocked)}>
            {method === 'COD' ? 'Place order' : `Pay ${tk(quote.total)}`}
          </Button>
          <p className="mt-2 text-center text-xs text-ink-faint">By placing your order you agree to our return policy.</p>
        </section>
      </aside>

      <Modal open={addressModal === 'pick'} onClose={() => setAddressModal(null)} title="Choose a delivery address">
        <ul className="space-y-2">
          {addresses.map((a) => (
            <li key={a.id}>
              <button
                onClick={() => {
                  setAddressId(a.id);
                  setAddressModal(null);
                }}
                className={clsx('w-full rounded-md border-2 p-3 text-left text-[15px]', a.id === addressId ? 'border-padma bg-padma-tint/40' : 'border-line hover:border-ink-faint')}
              >
                <span className="font-semibold">{a.fullName}</span> <span className="text-ink-soft">{a.phone}</span>
                <span className="ml-2 rounded bg-black/5 px-1.5 py-0.5 text-xs font-semibold text-ink-soft">{a.label}</span>
                <span className="block text-sm text-ink-soft">
                  {a.line}, {a.area}, {a.district}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <Button variant="secondary" block className="mt-3" onClick={() => setAddressModal('new')}>
          Add a new address
        </Button>
      </Modal>
      <Modal open={addressModal === 'new'} onClose={() => setAddressModal(null)} title="New delivery address" wide>
        <AddressForm
          defaultName={user.name}
          defaultPhone={user.phone}
          onSaved={(a) => {
            setAddresses((list) => [a, ...list.map((x) => (a.isDefault ? { ...x, isDefault: false } : x))]);
            setAddressId(a.id);
            setAddressModal(null);
          }}
        />
      </Modal>
    </div>
  );
}

function Row({ label, value, good }: { label: string; value: string; good?: boolean }) {
  return (
    <div className="flex justify-between">
      <dt className="text-ink-soft">{label}</dt>
      <dd className={clsx('font-medium', good && 'text-padma')}>{value}</dd>
    </div>
  );
}
