'use client';

import clsx from 'clsx';
import { Banknote, BellRing, Heart, RotateCcw, ShieldCheck, TrendingDown, Truck, Zap } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { ApiError, del, post } from '@/lib/api';
import { tk, voucherValue } from '@/lib/format';
import type { Locations } from '@/lib/types';
import { useSession, useToast } from '../providers';
import { Button, Price, QtyStepper, Select, Stars } from '../ui';
import { Countdown } from './countdown';

export interface ProductDetail {
  id: string;
  slug: string;
  title: string;
  description: string;
  highlights: string[];
  optionNames: string[];
  specs: { name: string; value: string }[];
  warranty: string | null;
  returnDays: number;
  ratingAvg: number;
  ratingCount: number;
  soldCount: number;
  brand: { name: string; slug: string } | null;
  category: { name: string; slug: string };
  breadcrumb: { name: string; slug: string }[];
  images: { url: string; alt: string | null }[];
  variants: {
    id: string;
    sku: string;
    options: Record<string, string>;
    label: string | null;
    imageUrl: string | null;
    stock: number;
    price: number;
    originalPrice: number;
    discountPct: number;
    flash: { endsAt: string; title: string; soldQty: number; quantityLimit: number; perUserLimit: number } | null;
  }[];
  wishlisted: boolean;
  /** "Notify me" alerts the signed-in customer is waiting on (empty when logged out). */
  myAlerts?: ProductAlert[];
  delivery: { zones: { zone: string; label: string; fee: number; days: string }[]; freeShippingThreshold: number; codAvailable: boolean };
  vouchers: { id: string; code: string; title: string; type: string; value: number; maxDiscount: number | null; minSpend: number; endsAt: string; collected: boolean }[];
}

export type AlertType = 'PRICE_DROP' | 'BACK_IN_STOCK';
export interface ProductAlert {
  id: string;
  variantId: string;
  type: AlertType;
}

function useLoginGate() {
  const { user } = useSession();
  const router = useRouter();
  return (next: string) => {
    if (user) return true;
    router.push(`/login?next=${encodeURIComponent(next)}`);
    return false;
  };
}

export function ProductView({ product, locations }: { product: ProductDetail; locations: Locations | null }) {
  const router = useRouter();
  const toast = useToast();
  const { setCartCount, user } = useSession();
  const gate = useLoginGate();
  const here = `/product/${product.slug}`;

  // Pick the first in-stock variant to start with.
  const firstAvailable = product.variants.find((v) => v.stock > 0) ?? product.variants[0];
  const [selected, setSelected] = useState<Record<string, string>>(firstAvailable?.options ?? {});
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState<'cart' | 'buy' | null>(null);
  const [wish, setWish] = useState(product.wishlisted);
  const [alerts, setAlerts] = useState<ProductAlert[]>(product.myAlerts ?? []);
  const [alertBusy, setAlertBusy] = useState<AlertType | null>(null);

  const variant = useMemo(
    () => product.variants.find((v) => product.optionNames.every((name) => v.options[name] === selected[name])) ?? (product.optionNames.length ? null : product.variants[0]),
    [product, selected],
  );

  const gallery = useMemo(() => {
    const urls = product.images.map((i) => i.url);
    return urls.length ? urls : variant?.imageUrl ? [variant.imageUrl] : [];
  }, [product.images, variant]);
  const [imageIdx, setImageIdx] = useState(() => Math.max(0, product.images.findIndex((i) => i.url === firstAvailable?.imageUrl)));
  const shownImage = gallery[imageIdx] ?? gallery[0];

  function choose(name: string, value: string) {
    const next = { ...selected, [name]: value };
    setSelected(next);
    setQty(1);
    const match = product.variants.find((v) => product.optionNames.every((n) => v.options[n] === next[n]));
    const idx = match?.imageUrl ? gallery.indexOf(match.imageUrl) : -1;
    if (idx >= 0) setImageIdx(idx);
  }

  /** Is this option value available in combination with the other current choices? */
  function available(name: string, value: string) {
    return product.variants.some((v) => v.options[name] === value && v.stock > 0 && product.optionNames.every((n) => n === name || v.options[n] === selected[n]));
  }

  const maxQty = Math.max(1, Math.min(variant?.stock ?? 1, variant?.flash ? variant.flash.perUserLimit : 10));

  async function addToCart(buyNow: boolean) {
    if (!variant) return toast('Choose an option first', 'error');
    if (!gate(here)) return;
    if (buyNow) {
      router.push(`/checkout?buyNow=${variant.id}&qty=${qty}`);
      return;
    }
    setBusy('cart');
    try {
      const cart = await post<{ items: unknown[] }>('/cart/items', { variantId: variant.id, quantity: qty });
      setCartCount(cart.items.length);
      toast('Added to your cart');
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Could not add to cart', 'error');
    } finally {
      setBusy(null);
    }
  }

  async function toggleWish() {
    if (!gate(here)) return;
    try {
      if (wish) await del(`/wishlist/${product.id}`);
      else await post('/wishlist', { productId: product.id });
      setWish(!wish);
      toast(wish ? 'Removed from wishlist' : 'Saved to wishlist');
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Could not update wishlist', 'error');
    }
  }

  const alertFor = (type: AlertType) => (variant ? alerts.find((a) => a.variantId === variant.id && a.type === type) : undefined);

  async function toggleAlert(type: AlertType) {
    if (!variant) return;
    if (!gate(here)) return;
    const existing = alertFor(type);
    setAlertBusy(type);
    try {
      if (existing) {
        await del(`/alerts/${existing.id}`);
        setAlerts((list) => list.filter((a) => a.id !== existing.id));
        toast(type === 'BACK_IN_STOCK' ? 'Stock alert cancelled' : 'Price alert cancelled');
      } else {
        const created = await post<ProductAlert>('/alerts', { variantId: variant.id, type });
        setAlerts((list) => [...list.filter((a) => !(a.variantId === variant.id && a.type === type)), { id: created.id, variantId: variant.id, type }]);
        toast(user?.marketingSms === false ? "We'll send you a notification" : "We'll send you a notification and an SMS");
      }
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Could not update the alert', 'error');
    } finally {
      setAlertBusy(null);
    }
  }

  const [district, setDistrict] = useState('Dhaka');
  const zoneOf = (d: string) => locations?.divisions.flatMap((x) => x.districts).find((x) => x.name === d)?.zone ?? 'OUTSIDE_DHAKA';
  const zone = product.delivery.zones.find((z) => z.zone === zoneOf(district));

  const flash = variant?.flash;
  const outOfStock = !!variant && variant.stock <= 0;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="grid gap-5 rounded-[var(--radius-card)] border border-line bg-white p-3 sm:p-5 md:grid-cols-[minmax(0,420px)_1fr]">
        {/* Gallery */}
        <div>
          <div className="relative aspect-square overflow-hidden rounded-md bg-paper">
            {shownImage && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={shownImage} alt={product.title} className="size-full object-cover" />
            )}
            {flash && (
              <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded bg-marigold px-2 py-1 text-sm font-bold text-ink">
                <Zap className="size-4 fill-ink" /> Flash deal
              </span>
            )}
          </div>
          {gallery.length > 1 && (
            <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto">
              {gallery.map((url, i) => (
                <button
                  key={url}
                  onClick={() => setImageIdx(i)}
                  className={clsx('size-16 shrink-0 overflow-hidden rounded border-2', i === imageIdx ? 'border-padma' : 'border-transparent')}
                  aria-label={`Show image ${i + 1}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="size-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Buy box */}
        <div className="min-w-0">
          <h1 className="text-xl font-semibold leading-snug sm:text-2xl">{product.title}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-soft">
            {product.ratingCount > 0 ? (
              <a href="#reviews" className="flex items-center gap-1.5 hover:text-padma">
                <Stars value={product.ratingAvg} size={15} />
                <span>
                  {product.ratingAvg} ({product.ratingCount} {product.ratingCount === 1 ? 'review' : 'reviews'})
                </span>
              </a>
            ) : (
              <span>No reviews yet</span>
            )}
            {product.soldCount > 0 && <span>{product.soldCount.toLocaleString('en-IN')} sold</span>}
            {product.brand && (
              <span>
                Brand{' '}
                <a href={`/search?brand=${product.brand.slug}`} className="font-semibold text-padma hover:underline">
                  {product.brand.name}
                </a>
              </span>
            )}
          </div>

          <div className="mt-4">
            {flash && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-t-md bg-marigold px-3 py-2 text-ink">
                <span className="flex items-center gap-1 font-bold">
                  <Zap className="size-4 fill-ink" /> {flash.title}
                </span>
                <span className="ml-auto flex items-center gap-2 text-sm">
                  Ends in <Countdown to={flash.endsAt} />
                </span>
              </div>
            )}
            <div className={clsx('px-3 py-3', flash ? 'rounded-b-md bg-marigold-tint' : 'rounded-md bg-paper')}>
              {variant ? <Price price={variant.price} original={variant.originalPrice} size="xl" /> : <span className="text-ink-soft">Choose an option to see the price</span>}
              {flash && (
                <p className="mt-1 text-sm text-ink-soft">
                  {flash.quantityLimit - flash.soldQty} left at this price. Limit {flash.perUserLimit} per customer.
                </p>
              )}
              {variant && !outOfStock && (
                <PriceDropToggle on={!!alertFor('PRICE_DROP')} busy={alertBusy === 'PRICE_DROP'} onToggle={() => toggleAlert('PRICE_DROP')} />
              )}
            </div>
          </div>

          {product.vouchers.length > 0 && <VoucherRow vouchers={product.vouchers} />}

          {product.optionNames.map((name) => {
            const values = [...new Set(product.variants.map((v) => v.options[name]).filter(Boolean))];
            return (
              <fieldset key={name} className="mt-4">
                <legend className="mb-1.5 text-[15px]">
                  <span className="text-ink-soft">{name}:</span> <span className="font-semibold">{selected[name]}</span>
                </legend>
                <div className="flex flex-wrap gap-2">
                  {values.map((value) => {
                    const ok = available(name, value);
                    const on = selected[name] === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => choose(name, value)}
                        aria-pressed={on}
                        className={clsx(
                          'min-w-12 rounded-md border px-3 py-1.5 text-sm font-medium',
                          on ? 'border-padma bg-padma-tint text-padma-dark' : 'border-line hover:border-ink-faint',
                          !ok && 'text-ink-faint line-through decoration-ink-faint/60',
                        )}
                      >
                        {value}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            );
          })}

          <div className="mt-4 flex items-center gap-3">
            <span className="text-[15px] text-ink-soft">Quantity</span>
            <QtyStepper value={qty} max={maxQty} onChange={setQty} disabled={!variant || outOfStock} />
            {variant && variant.stock > 0 && variant.stock <= 5 && <span className="text-sm font-semibold text-sindoor">Only {variant.stock} left</span>}
            {outOfStock && <span className="text-sm font-semibold text-sindoor">Out of stock</span>}
          </div>

          <div className="mt-5 flex gap-2">
            {outOfStock ? (
              alertFor('BACK_IN_STOCK') ? (
                <div className="flex min-h-12 min-w-0 flex-1 items-center gap-2 rounded-md bg-padma-tint py-1.5 pl-3 pr-1.5 text-[15px] text-padma-dark" role="status">
                  <BellRing className="size-5 shrink-0" aria-hidden />
                  <span className="min-w-0 flex-1 font-semibold leading-snug">We&apos;ll tell you when it&apos;s back</span>
                  <button
                    type="button"
                    onClick={() => toggleAlert('BACK_IN_STOCK')}
                    disabled={alertBusy === 'BACK_IN_STOCK'}
                    className="shrink-0 rounded-md px-2.5 py-1.5 text-sm font-semibold text-ink-soft hover:bg-white/70 hover:text-ink disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <Button size="lg" className="min-w-0 flex-1" onClick={() => toggleAlert('BACK_IN_STOCK')} loading={alertBusy === 'BACK_IN_STOCK'}>
                  {alertBusy !== 'BACK_IN_STOCK' && <BellRing className="size-5" aria-hidden />}
                  Notify me when it&apos;s back
                </Button>
              )
            ) : (
              <>
                <Button size="lg" variant="deal" className="flex-1 whitespace-nowrap px-3 sm:px-6" onClick={() => addToCart(true)} disabled={!variant} loading={busy === 'buy'}>
                  Buy now
                </Button>
                <Button size="lg" className="flex-1 whitespace-nowrap px-3 sm:px-6" onClick={() => addToCart(false)} disabled={!variant} loading={busy === 'cart'}>
                  Add to cart
                </Button>
              </>
            )}
            <Button size="lg" variant="outline" onClick={toggleWish} aria-pressed={wish} aria-label={wish ? 'Remove from wishlist' : 'Save to wishlist'} className="px-3">
              <Heart className={clsx('size-5', wish && 'fill-sindoor text-sindoor')} />
            </Button>
          </div>
          {outOfStock && !alertFor('BACK_IN_STOCK') && (
            <p className="mt-2 text-sm text-ink-soft">This one is sold out for now. Tap the button and we&apos;ll let you know as soon as it&apos;s in stock again.</p>
          )}
          {variant && <p className="mt-2 text-xs text-ink-faint">SKU {variant.sku}</p>}

          {product.highlights.length > 0 && (
            <ul className="mt-5 space-y-1.5 border-t border-line pt-4 text-[15px]">
              {product.highlights.map((h) => (
                <li key={h} className="flex gap-2">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-marigold" />
                  {h}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Delivery and service */}
      <aside className="space-y-3">
        <div className="rounded-[var(--radius-card)] border border-line bg-white p-4 text-[15px]">
          <h2 className="mb-2 font-semibold">Delivery</h2>
          <label className="mb-3 block">
            <span className="mb-1 block text-sm text-ink-soft">Deliver to</span>
            <Select value={district} onChange={(e) => setDistrict(e.target.value)} className="h-9">
              {(locations?.divisions ?? []).map((d) => (
                <optgroup key={d.name} label={`${d.name} division`}>
                  {d.districts.map((x) => (
                    <option key={x.name} value={x.name}>
                      {x.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </Select>
          </label>
          {zone && (
            <div className="flex gap-3">
              <Truck className="mt-0.5 size-5 shrink-0 text-padma" />
              <div>
                <p className="font-medium">
                  {zone.label}: {tk(zone.fee)}
                </p>
                <p className="text-sm text-ink-soft">
                  Arrives in {zone.days} days. Free over {tk(product.delivery.freeShippingThreshold)}.
                </p>
              </div>
            </div>
          )}
          {product.delivery.codAvailable && (
            <div className="mt-3 flex gap-3">
              <Banknote className="mt-0.5 size-5 shrink-0 text-padma" />
              <p>Cash on delivery available</p>
            </div>
          )}
        </div>
        <div className="space-y-3 rounded-[var(--radius-card)] border border-line bg-white p-4 text-[15px]">
          <h2 className="font-semibold">Service</h2>
          <div className="flex gap-3">
            <RotateCcw className="mt-0.5 size-5 shrink-0 text-padma" />
            <p>{product.returnDays > 0 ? `${product.returnDays}-day easy returns` : 'Not returnable once opened'}</p>
          </div>
          <div className="flex gap-3">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-padma" />
            <p>{product.warranty ?? 'Authentic product, checked before dispatch'}</p>
          </div>
        </div>
      </aside>
    </div>
  );
}

function PriceDropToggle({ on, busy, onToggle }: { on: boolean; busy: boolean; onToggle: () => void }) {
  if (on) {
    return (
      <p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 text-sm text-padma-dark" role="status">
        <BellRing className="size-4 shrink-0" aria-hidden />
        <span className="font-medium">We&apos;ll tell you if the price drops</span>
        <span aria-hidden className="text-ink-faint">
          ·
        </span>
        <button type="button" onClick={onToggle} disabled={busy} className="font-semibold text-ink-soft underline-offset-2 hover:text-ink hover:underline disabled:opacity-50">
          Cancel
        </button>
      </p>
    );
  }
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={busy}
      className="mt-1.5 flex w-fit items-center gap-1.5 text-sm font-semibold text-padma underline-offset-2 hover:underline disabled:opacity-50"
    >
      <TrendingDown className="size-4" aria-hidden />
      Alert me if the price drops
    </button>
  );
}

function VoucherRow({ vouchers }: { vouchers: ProductDetail['vouchers'] }) {
  const toast = useToast();
  const gate = useLoginGate();
  const [collected, setCollected] = useState(() => new Set(vouchers.filter((v) => v.collected).map((v) => v.id)));
  async function collect(id: string) {
    if (!gate(window.location.pathname)) return;
    try {
      await post(`/vouchers/${id}/collect`);
      setCollected((s) => new Set(s).add(id));
      toast('Voucher collected. It will apply at checkout.');
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Could not collect voucher', 'error');
    }
  }
  return (
    <div className="mt-4">
      <p className="mb-1.5 text-[15px] text-ink-soft">Store vouchers</p>
      <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
        {vouchers.map((v) => {
          const got = collected.has(v.id);
          return (
            <div key={v.id} className="ticket flex shrink-0 items-center text-sm" style={{ ['--ticket-bg' as string]: '#fff' }}>
              <div className="px-3 py-1.5">
                <p className="font-bold text-marigold-dark">{voucherValue(v)}</p>
                <p className="text-xs text-ink-soft">{v.minSpend ? `Min. spend ${tk(v.minSpend)}` : 'No minimum'}</p>
              </div>
              <div className="ticket-divider self-stretch" />
              <button onClick={() => !got && collect(v.id)} disabled={got} className="px-3 py-1.5 font-semibold text-padma disabled:text-ink-faint">
                {got ? 'Collected' : 'Collect'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
