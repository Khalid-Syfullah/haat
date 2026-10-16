'use client';

import clsx from 'clsx';
import { Heart, ShoppingCart, Trash2, Zap } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ApiError, del, patch, post } from '@/lib/api';
import { tk } from '@/lib/format';
import { useSession, useToast } from '../providers';
import { Button, EmptyState, QtyStepper } from '../ui';

export interface CartData {
  items: {
    id: string;
    quantity: number;
    selected: boolean;
    maxQty: number;
    issue: 'OUT_OF_STOCK' | 'NOT_ENOUGH_STOCK' | 'UNAVAILABLE' | null;
    variant: { id: string; sku: string; label: string | null; stock: number };
    product: { id: string; slug: string; title: string; brand: string | null; image: string | null };
    unitPrice: number;
    originalPrice: number;
    discountPct: number;
    flash: boolean;
    lineTotal: number;
  }[];
  summary: { lines: number; selectedLines: number; selectedQty: number; subtotal: number; savings: number };
}

const ISSUE_TEXT = {
  OUT_OF_STOCK: 'Out of stock. Remove it or save it for later.',
  NOT_ENOUGH_STOCK: 'Not enough stock for this quantity.',
  UNAVAILABLE: 'No longer sold.',
};

export function CartView({ initial, freeShippingThreshold }: { initial: CartData; freeShippingThreshold: number }) {
  const [cart, setCart] = useState(initial);
  const [pending, setPending] = useState<string | null>(null);
  const { setCartCount } = useSession();
  const toast = useToast();
  const router = useRouter();

  async function run(key: string, fn: () => Promise<CartData>, message?: string) {
    setPending(key);
    try {
      const next = await fn();
      setCart(next);
      setCartCount(next.items.length);
      if (message) toast(message);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Could not update your cart', 'error');
    } finally {
      setPending(null);
    }
  }

  if (!cart.items.length) {
    return (
      <div className="rounded-[var(--radius-card)] border border-line bg-white">
        <EmptyState
          icon={<ShoppingCart className="size-12" />}
          title="Your cart is empty"
          body="Browse today's flash deals or search for something you need."
          action={
            <Link href="/" className="rounded-md bg-padma px-5 py-2.5 font-semibold text-white hover:bg-padma-dark">
              Start shopping
            </Link>
          }
        />
      </div>
    );
  }

  const allSelected = cart.items.every((i) => i.selected);
  const s = cart.summary;
  const toFree = Math.max(0, freeShippingThreshold - s.subtotal);
  const selectedIds = cart.items.filter((i) => i.selected).map((i) => i.id);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_340px] lg:items-start">
      <div className="space-y-3">
        <div className="flex items-center gap-3 rounded-[var(--radius-card)] border border-line bg-white px-4 py-3">
          <label className="flex items-center gap-2 text-[15px]">
            <input
              type="checkbox"
              className="size-4 accent-padma"
              checked={allSelected}
              onChange={(e) => run('all', () => post('/cart/select-all', { selected: e.target.checked }))}
            />
            Select all ({cart.items.length})
          </label>
          {selectedIds.length > 0 && (
            <button
              className="ml-auto flex items-center gap-1.5 text-sm font-medium text-ink-soft hover:text-sindoor"
              onClick={() => run('remove', () => post('/cart/remove', { ids: selectedIds }), 'Removed from cart')}
            >
              <Trash2 className="size-4" /> Remove selected
            </button>
          )}
        </div>

        <ul className="divide-y divide-line rounded-[var(--radius-card)] border border-line bg-white">
          {cart.items.map((item) => (
            <li key={item.id} className={clsx('flex gap-3 p-3 sm:p-4', pending === item.id && 'opacity-60')}>
              <input
                type="checkbox"
                className="mt-8 size-4 shrink-0 accent-padma"
                checked={item.selected}
                disabled={!!item.issue}
                onChange={(e) => run(item.id, () => patch(`/cart/items/${item.id}`, { selected: e.target.checked }))}
                aria-label={`Select ${item.product.title}`}
              />
              <Link href={`/product/${item.product.slug}`} className="size-20 shrink-0 overflow-hidden rounded bg-paper sm:size-24">
                {item.product.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.product.image} alt="" className="size-full object-cover" />
                )}
              </Link>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap justify-between gap-x-4 gap-y-1">
                  <div className="min-w-0">
                    <Link href={`/product/${item.product.slug}`} className="line-clamp-2 text-[15px] hover:text-padma">
                      {item.product.title}
                    </Link>
                    {item.variant.label && <p className="text-sm text-ink-soft">{item.variant.label}</p>}
                    {item.flash && (
                      <p className="mt-0.5 inline-flex items-center gap-1 text-xs font-semibold text-marigold-dark">
                        <Zap className="size-3 fill-marigold text-marigold" /> Flash price
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-sindoor">{tk(item.unitPrice)}</p>
                    {item.discountPct > 0 && (
                      <p className="text-xs text-ink-faint">
                        <span className="line-through">{tk(item.originalPrice)}</span> -{item.discountPct}%
                      </p>
                    )}
                  </div>
                </div>
                {item.issue && <p className="mt-1 text-sm font-medium text-sindoor">{ISSUE_TEXT[item.issue]}</p>}
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <QtyStepper
                    value={item.quantity}
                    max={Math.max(item.quantity, item.maxQty)}
                    disabled={pending === item.id || item.issue === 'OUT_OF_STOCK' || item.issue === 'UNAVAILABLE'}
                    onChange={(q) => run(item.id, () => patch(`/cart/items/${item.id}`, { quantity: q }))}
                  />
                  <button
                    className="flex items-center gap-1 text-sm text-ink-soft hover:text-padma"
                    onClick={() => run(item.id, () => post(`/cart/items/${item.id}/save-for-later`), 'Moved to your wishlist')}
                  >
                    <Heart className="size-4" /> Save for later
                  </button>
                  <button className="flex items-center gap-1 text-sm text-ink-soft hover:text-sindoor" onClick={() => run(item.id, () => del(`/cart/items/${item.id}`), 'Removed from cart')}>
                    <Trash2 className="size-4" /> Remove
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <aside className="rounded-[var(--radius-card)] border border-line bg-white p-4 lg:sticky lg:top-36">
        <h2 className="text-lg font-semibold">Order summary</h2>
        <dl className="mt-3 space-y-2 text-[15px]">
          <div className="flex justify-between">
            <dt className="text-ink-soft">
              Subtotal ({s.selectedQty} {s.selectedQty === 1 ? 'item' : 'items'})
            </dt>
            <dd className="font-semibold">{tk(s.subtotal)}</dd>
          </div>
          {s.savings > 0 && (
            <div className="flex justify-between text-padma">
              <dt>You save</dt>
              <dd className="font-semibold">{tk(s.savings)}</dd>
            </div>
          )}
          <div className="flex justify-between text-ink-soft">
            <dt>Delivery</dt>
            <dd>Calculated at checkout</dd>
          </div>
        </dl>
        {s.subtotal > 0 && (
          <div className="mt-4 rounded-md bg-marigold-tint px-3 py-2.5 text-sm">
            {toFree > 0 ? (
              <>
                Add <span className="font-bold">{tk(toFree)}</span> more for free delivery.
              </>
            ) : (
              <span className="font-semibold">Your order gets free delivery.</span>
            )}
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white">
              <div className="h-full rounded-full bg-marigold" style={{ width: `${Math.min(100, (s.subtotal / freeShippingThreshold) * 100)}%` }} />
            </div>
          </div>
        )}
        <Button size="lg" block className="mt-4" disabled={s.selectedLines === 0} onClick={() => router.push('/checkout')}>
          Check out ({s.selectedLines})
        </Button>
        <p className="mt-2 text-center text-xs text-ink-faint">Apply vouchers and coins on the next step</p>
      </aside>
    </div>
  );
}
