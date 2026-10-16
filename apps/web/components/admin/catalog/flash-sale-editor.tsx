'use client';

import { ChevronLeft, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { useToast } from '@/components/providers';
import { Badge, Button, clsx, Field, Input, Spinner } from '@/components/ui';
import { api, del, patch, post } from '@/lib/api';
import { tk } from '@/lib/format';
import { DeleteButton, Toggle } from './common';
import { FlashSaleRow } from './flash-types';
import type { AdminProduct } from './product-editor';
import { errorMessage, fromDhakaInput, Panel, PanelTitle, phaseOf, PhaseBadge, td, th, thNum, Thumb, toDhakaInput } from './utils';

interface ItemRow {
  key: string;
  variantId: string;
  title: string;
  variantLabel: string | null;
  sku: string;
  image: string | null;
  price: number;
  stock: number;
  soldQty: number;
  saved: boolean;
  flashPrice: string;
  quantityLimit: string;
  perUserLimit: string;
}

interface ProductHit {
  id: string;
  title: string;
  image: string | null;
  status: string;
  variants: number;
  minPrice: number;
}

let seq = 0;
const uid = () => `f${++seq}`;
const whole = (s: string, min: number) => s.trim() !== '' && Number.isInteger(Number(s)) && Number(s) >= min;

function labelFor(options: Record<string, string> | null, order: string[]) {
  if (!options) return null;
  const rank = (k: string) => {
    const i = order.indexOf(k);
    return i >= 0 ? i : k === 'Color' ? -1 : 100;
  };
  const vals = Object.keys(options)
    .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))
    .map((k) => options[k])
    .filter(Boolean);
  return vals.length ? vals.join(', ') : null;
}

function initialTimes() {
  const start = new Date(Date.now() + 3600_000);
  start.setMinutes(0, 0, 0);
  return { startsAt: toDhakaInput(start), endsAt: toDhakaInput(new Date(start.getTime() + 12 * 3600_000)) };
}

export function FlashSaleRowActions({ sale }: { sale: { id: string; title: string; sold: number } }) {
  const router = useRouter();
  const toast = useToast();
  return (
    <>
      <Link href={`/admin/flash-sales/${sale.id}`} className="inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-sm font-semibold text-ink-soft hover:bg-black/5 hover:text-ink">
        <Pencil className="size-4" aria-hidden />
        Edit
      </Link>
      <DeleteButton
        iconOnly
        label={`Delete ${sale.title}`}
        title="Delete flash sale"
        body={
          sale.sold > 0 ? (
            <>
              <span className="font-semibold text-ink">{sale.title}</span> already sold {sale.sold} items, so it will be switched off instead of deleted.
            </>
          ) : (
            <>
              Delete <span className="font-semibold text-ink">{sale.title}</span> and all its items?
            </>
          )
        }
        confirmLabel={sale.sold > 0 ? 'Switch off flash sale' : 'Delete flash sale'}
        onConfirm={async () => {
          try {
            const res = await del<{ deactivated?: boolean }>(`/admin/flash-sales/${sale.id}`);
            toast(res?.deactivated ? 'Flash sale had sales, so it was switched off' : 'Flash sale deleted');
            router.refresh();
          } catch (e) {
            toast(errorMessage(e), 'error');
          }
        }}
      />
    </>
  );
}

export function FlashSaleEditor({ sale }: { sale?: FlashSaleRow }) {
  const router = useRouter();
  const toast = useToast();
  const [title, setTitle] = useState(sale?.title ?? '');
  const [times, setTimes] = useState(() => (sale ? { startsAt: toDhakaInput(sale.startsAt), endsAt: toDhakaInput(sale.endsAt) } : initialTimes()));
  const [isActive, setIsActive] = useState(sale?.isActive ?? true);
  const [items, setItems] = useState<ItemRow[]>(() =>
    (sale?.items ?? []).map((i) => ({
      key: uid(),
      variantId: i.variantId,
      title: i.title,
      variantLabel: i.variantLabel,
      sku: i.sku,
      image: i.image,
      price: i.price,
      stock: i.stock,
      soldQty: i.soldQty,
      saved: true,
      flashPrice: String(i.flashPrice),
      quantityLimit: String(i.quantityLimit),
      perUserLimit: String(i.perUserLimit),
    })),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [now] = useState(() => Date.now());

  const setItem = (key: string, patchRow: Partial<ItemRow>) => {
    setItems((list) => list.map((i) => (i.key === key ? { ...i, ...patchRow } : i)));
    setErrors((e) => {
      if (!e[`i:${key}`]) return e;
      const { [`i:${key}`]: _gone, ...rest } = e;
      return rest;
    });
  };

  function addVariant(p: AdminProduct, v: AdminProduct['variants'][number]) {
    if (items.some((i) => i.variantId === v.id)) return;
    const current = v.salePrice ?? v.price;
    setItems((list) => [
      ...list,
      {
        key: uid(),
        variantId: v.id,
        title: p.title,
        variantLabel: labelFor(v.options, p.optionNames),
        sku: v.sku,
        image: v.imageUrl || p.images[0]?.url || null,
        price: current,
        stock: v.stock,
        soldQty: 0,
        saved: false,
        flashPrice: String(Math.max(1, Math.floor((current * 0.8) / 10) * 10 - 1)),
        quantityLimit: String(Math.max(1, Math.min(v.stock, 50))),
        perUserLimit: '2',
      },
    ]);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (title.trim().length < 2) errs.title = 'Enter at least 2 characters';
    const startsAt = fromDhakaInput(times.startsAt);
    const endsAt = fromDhakaInput(times.endsAt);
    if (!startsAt) errs.startsAt = 'Pick a start date and time';
    if (!endsAt) errs.endsAt = 'Pick an end date and time';
    else if (startsAt && endsAt <= startsAt) errs.endsAt = 'End must be after the start';
    items.forEach((i, n) => {
      const m: string[] = [];
      if (!whole(i.flashPrice, 1)) m.push('enter a flash price in whole taka');
      else if (Number(i.flashPrice) >= i.price) m.push(`flash price must be below ${tk(i.price)}`);
      if (!whole(i.quantityLimit, 1)) m.push('stock cap must be 1 or more');
      else if (Number(i.quantityLimit) < i.soldQty) m.push(`stock cap cannot go below the ${i.soldQty} already sold`);
      if (!whole(i.perUserLimit, 1) || Number(i.perUserLimit) > 20) m.push('per-customer limit must be 1 to 20');
      if (m.length) errs[`i:${i.key}`] = `Row ${n + 1} (${i.sku}): ${m.join(', ')}`;
    });
    setErrors(errs);
    if (Object.keys(errs).length) {
      toast(Object.values(errs)[0], 'error');
      return;
    }
    const body = {
      title: title.trim(),
      startsAt,
      endsAt,
      isActive,
      items: items.map((i) => ({ variantId: i.variantId, flashPrice: Number(i.flashPrice), quantityLimit: Number(i.quantityLimit), perUserLimit: Number(i.perUserLimit) })),
    };
    setSaving(true);
    try {
      if (sale) await patch(`/admin/flash-sales/${sale.id}`, body);
      else await post('/admin/flash-sales', body);
      toast(sale ? 'Flash sale saved' : 'Flash sale created');
      router.push('/admin/flash-sales');
      router.refresh();
    } catch (err) {
      toast(errorMessage(err), 'error');
      setSaving(false);
    }
  }

  const itemErrors = items.map((i) => errors[`i:${i.key}`]).filter(Boolean);
  const phase = sale ? phaseOf(sale.startsAt, sale.endsAt, sale.isActive, now) : null;

  return (
    <form onSubmit={submit} noValidate>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/admin/flash-sales" className="inline-flex items-center gap-1 text-sm text-ink-soft hover:text-ink">
            <ChevronLeft className="size-4" aria-hidden />
            Flash sales
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-ink">{sale ? sale.title : 'New flash sale'}</h1>
            {phase && <PhaseBadge phase={phase} />}
          </div>
        </div>
        <Button type="submit" loading={saving}>
          {sale ? 'Save flash sale' : 'Create flash sale'}
        </Button>
      </div>

      <Panel>
        <PanelTitle title="Details" description="Times are Bangladesh time." />
        <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_1fr_1fr]">
          <Field label="Title" error={errors.title}>
            <Input value={title} maxLength={80} placeholder="e.g. Payday Flash Sale" onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label="Starts" error={errors.startsAt}>
            <Input type="datetime-local" value={times.startsAt} onChange={(e) => setTimes((t) => ({ ...t, startsAt: e.target.value }))} />
          </Field>
          <Field label="Ends" error={errors.endsAt}>
            <Input type="datetime-local" value={times.endsAt} onChange={(e) => setTimes((t) => ({ ...t, endsAt: e.target.value }))} />
          </Field>
          <div className="sm:col-span-2 lg:col-span-3">
            <Toggle label="Active" hint="Switch off to pause the sale without deleting it." checked={isActive} onChange={setIsActive} />
          </div>
        </div>
      </Panel>

      <Panel className="mt-5">
        <PanelTitle title="Items" description="Each variant gets its own flash price, stock cap and per-customer limit." />
        <ProductPicker addedIds={new Set(items.map((i) => i.variantId))} onAdd={addVariant} />
        {items.length === 0 ? (
          <p className="px-4 py-8 text-center text-ink-soft">No items yet. Search for a product above and add its variants.</p>
        ) : (
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[920px] text-sm">
              <thead>
                <tr>
                  <th className={th}>Variant</th>
                  <th className={thNum}>Current price</th>
                  <th className={thNum}>Flash price</th>
                  <th className={thNum}>Stock cap</th>
                  <th className={thNum}>Per customer</th>
                  <th className={thNum}>Sold</th>
                  <th className={th}>
                    <span className="sr-only">Remove</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((i, n) => {
                  const fp = Number(i.flashPrice);
                  const off = whole(i.flashPrice, 1) && fp < i.price ? Math.round((1 - fp / i.price) * 100) : null;
                  const cap = Number(i.quantityLimit);
                  const pct = whole(i.quantityLimit, 1) ? Math.min(100, Math.round((i.soldQty / cap) * 100)) : 0;
                  const bad = Boolean(errors[`i:${i.key}`]);
                  return (
                    <tr key={i.key} className={clsx(bad && 'bg-sindoor-tint/40')}>
                      <td className={td}>
                        <div className="flex items-center gap-3">
                          <Thumb src={i.image} size={36} />
                          <div className="min-w-0">
                            <p className="font-medium text-ink">{i.title}</p>
                            <p className="text-xs text-ink-soft">
                              {i.variantLabel ? `${i.variantLabel}, ` : ''}
                              <span className="font-mono">{i.sku}</span>
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="border-b border-line px-3 py-2 text-right tabular-nums">{tk(i.price)}</td>
                      <td className="border-b border-line px-2 py-2 text-right">
                        <Input
                          className="ml-auto h-9 min-w-24 max-w-24 text-right tabular-nums"
                          type="number"
                          inputMode="numeric"
                          min={1}
                          value={i.flashPrice}
                          aria-label={`Flash price for ${i.sku}`}
                          onChange={(e) => setItem(i.key, { flashPrice: e.target.value })}
                        />
                        <span className={clsx('mt-0.5 block text-xs', off != null ? 'text-sindoor' : 'text-ink-faint')}>{off != null ? `${off}% off` : 'Must be lower'}</span>
                      </td>
                      <td className="border-b border-line px-2 py-2 text-right">
                        <Input
                          className="ml-auto h-9 min-w-20 max-w-20 text-right tabular-nums"
                          type="number"
                          inputMode="numeric"
                          min={Math.max(1, i.soldQty)}
                          value={i.quantityLimit}
                          aria-label={`Stock cap for ${i.sku}`}
                          onChange={(e) => setItem(i.key, { quantityLimit: e.target.value })}
                        />
                        <span className={clsx('mt-0.5 block text-xs', whole(i.quantityLimit, 1) && cap > i.stock ? 'text-marigold-dark' : 'text-ink-faint')}>{i.stock} in stock</span>
                      </td>
                      <td className="border-b border-line px-2 py-2 text-right">
                        <Input
                          className="ml-auto h-9 min-w-16 max-w-16 text-right tabular-nums"
                          type="number"
                          inputMode="numeric"
                          min={1}
                          max={20}
                          value={i.perUserLimit}
                          aria-label={`Per-customer limit for ${i.sku}`}
                          onChange={(e) => setItem(i.key, { perUserLimit: e.target.value })}
                        />
                      </td>
                      <td className="border-b border-line px-3 py-2 text-right tabular-nums">
                        {i.saved ? (
                          <div className="ml-auto w-28">
                            <span>
                              {i.soldQty} <span className="text-ink-faint">/ {whole(i.quantityLimit, 1) ? cap : '?'}</span>
                            </span>
                            <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-paper" aria-hidden>
                              <span className="block h-full rounded-full bg-marigold" style={{ width: `${pct}%` }} />
                            </span>
                          </div>
                        ) : (
                          <Badge tone="blue">New</Badge>
                        )}
                      </td>
                      <td className="border-b border-line px-2 py-2 text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={i.soldQty > 0}
                          title={i.soldQty > 0 ? 'Items that already sold cannot be removed' : undefined}
                          aria-label={`Remove row ${n + 1}`}
                          onClick={() => setItems((list) => list.filter((x) => x.key !== i.key))}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {itemErrors.length > 0 && (
          <ul className="flex flex-col gap-0.5 px-4 py-3 text-sm text-sindoor">
            {itemErrors.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        )}
      </Panel>

      <div className="sticky bottom-0 z-10 -mx-4 mt-5 flex items-center justify-end gap-3 border-t border-line bg-white/95 px-4 py-3 sm:mx-0 sm:rounded-[6px] sm:border">
        <p className="mr-auto text-sm text-ink-soft">
          {items.length} item{items.length === 1 ? '' : 's'}
        </p>
        <Link href="/admin/flash-sales" className="inline-flex h-10 items-center rounded-md px-4 text-[15px] font-semibold text-ink-soft hover:bg-black/5 hover:text-ink">
          Cancel
        </Link>
        <Button type="submit" loading={saving}>
          {sale ? 'Save flash sale' : 'Create flash sale'}
        </Button>
      </div>
    </form>
  );
}

function ProductPicker({ addedIds, onAdd }: { addedIds: Set<string>; onAdd: (p: AdminProduct, v: AdminProduct['variants'][number]) => void }) {
  const toast = useToast();
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<ProductHit[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [product, setProduct] = useState<AdminProduct | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const term = q.trim();
    if (term.length < 2) {
      setHits(null);
      return;
    }
    let live = true;
    timer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await api<{ items: ProductHit[] }>(`/admin/products?limit=8&q=${encodeURIComponent(term)}`);
        if (live) setHits(res.items.filter((p) => p.status !== 'ARCHIVED'));
      } catch (e) {
        if (live) toast(errorMessage(e), 'error');
      } finally {
        if (live) setSearching(false);
      }
    }, 300);
    return () => {
      live = false;
    };
  }, [q, toast]);

  async function pick(id: string) {
    setLoadingId(id);
    try {
      setProduct(await api<AdminProduct>(`/admin/products/${id}`));
      setHits(null);
      setQ('');
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setLoadingId(null);
    }
  }

  const variants = product?.variants.filter((v) => v.isActive) ?? [];

  return (
    <div className="border-b border-line p-4">
      <label className="block max-w-xl">
        <span className="mb-1 block text-sm font-medium text-ink">Find a product</span>
        <span className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint" aria-hidden />
          <Input
            type="search"
            className="pl-9"
            value={q}
            placeholder="Title or SKU"
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (hits?.length === 1) pick(hits[0].id);
              }
            }}
          />
          {searching && <Spinner className="absolute right-3 top-1/2 size-4 -translate-y-1/2" />}
        </span>
      </label>
      {hits && (
        <div className="mt-2 max-w-xl overflow-hidden rounded-[6px] border border-line">
          {hits.length === 0 ? (
            <p className="px-3 py-3 text-sm text-ink-soft">No products found for that search.</p>
          ) : (
            <ul className="divide-y divide-line">
              {hits.map((h) => (
                <li key={h.id}>
                  <button type="button" onClick={() => pick(h.id)} className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-paper">
                    <Thumb src={h.image} size={32} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink">{h.title}</span>
                      <span className="block text-xs text-ink-soft">
                        {h.variants} variant{h.variants === 1 ? '' : 's'}, from {tk(h.minPrice)}
                      </span>
                    </span>
                    {h.status === 'DRAFT' && <Badge>Draft</Badge>}
                    {loadingId === h.id && <Spinner className="size-4" />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {product && (
        <div className="mt-3 rounded-[6px] border border-line">
          <div className="flex items-center gap-3 border-b border-line px-3 py-2">
            <Thumb src={product.images[0]?.url} size={32} />
            <p className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{product.title}</p>
            {variants.length > 1 && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={variants.every((v) => addedIds.has(v.id) || (v.salePrice ?? v.price) <= 1)}
                onClick={() => variants.filter((v) => !addedIds.has(v.id)).forEach((v) => onAdd(product, v))}
              >
                Add all variants
              </Button>
            )}
            <Button type="button" variant="ghost" size="sm" aria-label="Close product" onClick={() => setProduct(null)}>
              <X className="size-4" />
            </Button>
          </div>
          {variants.length === 0 ? (
            <p className="px-3 py-3 text-sm text-ink-soft">This product has no active variants.</p>
          ) : (
            <ul className="divide-y divide-line">
              {variants.map((v) => {
                const added = addedIds.has(v.id);
                return (
                  <li key={v.id} className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm">
                    <span className="min-w-0 flex-1">
                      <span className="font-medium text-ink">{labelFor(v.options, product.optionNames) ?? 'Default'}</span>
                      <span className="ml-2 font-mono text-xs text-ink-soft">{v.sku}</span>
                    </span>
                    <span className="tabular-nums text-ink-soft">{v.stock} in stock</span>
                    <span className="w-20 text-right tabular-nums font-medium text-ink">{tk(v.salePrice ?? v.price)}</span>
                    <Button type="button" variant={added ? 'ghost' : 'outline'} size="sm" disabled={added} onClick={() => onAdd(product, v)}>
                      {added ? 'Added' : (
                        <>
                          <Plus className="size-4" aria-hidden />
                          Add
                        </>
                      )}
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
