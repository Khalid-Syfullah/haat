import clsx from 'clsx';
import { BellRing, PackageCheck, TrendingDown } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { AlertRemoveButton } from '@/components/store/alert-actions';
import { Badge, EmptyState } from '@/components/ui';
import { relative, tk } from '@/lib/format';
import { serverApi } from '@/lib/server';

export const metadata: Metadata = { title: 'Price and stock alerts' };

interface AlertRow {
  id: string;
  type: 'PRICE_DROP' | 'BACK_IN_STOCK';
  createdAt: string;
  notifiedAt: string | null;
  priceAtSubscribe: number | null;
  currentPrice: number;
  inStock: boolean;
  product: { slug: string; title: string; image: string | null };
  variantId: string;
  variantLabel: string | null;
}

export default async function AlertsPage() {
  const rows = (await serverApi<AlertRow[]>('/alerts')) ?? [];
  const waiting = rows.filter((a) => !a.notifiedAt).sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  const sent = rows.filter((a) => a.notifiedAt).sort((a, b) => +new Date(b.notifiedAt!) - +new Date(a.notifiedAt!));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">Price and stock alerts</h1>
        <p className="text-[15px] text-ink-soft">We&apos;ll send you a notification when a price drops or a sold-out item comes back.</p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-[var(--radius-card)] border border-line bg-white">
          <EmptyState
            icon={<BellRing className="size-10" />}
            title="No alerts yet"
            body="On any product page, tap “Alert me if the price drops”. If an item is sold out, tap “Notify me when it's back”. Your alerts will show up here."
            action={
              <Link href="/" className="font-semibold text-padma hover:underline">
                Start shopping
              </Link>
            }
          />
        </div>
      ) : (
        <>
          <AlertSection title="Waiting" count={waiting.length} rows={waiting} empty="Nothing waiting. Add an alert from any product page." />
          {sent.length > 0 && <AlertSection title="Sent" count={sent.length} rows={sent} />}
        </>
      )}
    </div>
  );
}

function AlertSection({ title, count, rows, empty }: { title: string; count: number; rows: AlertRow[]; empty?: string }) {
  const id = `alerts-${title.toLowerCase()}`;
  return (
    <section className="rounded-[var(--radius-card)] border border-line bg-white" aria-labelledby={id}>
      <h2 id={id} className="border-b border-line px-4 py-3 font-semibold">
        {title} ({count})
      </h2>
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-ink-soft">{empty}</p>
      ) : (
        <ul className="divide-y divide-line">
          {rows.map((a) => (
            <AlertItem key={a.id} a={a} />
          ))}
        </ul>
      )}
    </section>
  );
}

function AlertItem({ a }: { a: AlertRow }) {
  const href = `/product/${a.product.slug}`;
  const dropped = a.priceAtSubscribe != null && a.currentPrice < a.priceAtSubscribe;
  return (
    <li className="flex gap-3 px-4 py-3">
      <Link href={href} className="size-16 shrink-0 overflow-hidden rounded bg-paper">
        {a.product.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={a.product.image} alt="" className="size-full object-cover" />
        )}
      </Link>
      <div className="min-w-0 flex-1 text-[15px]">
        <Link href={href} className="line-clamp-2 hover:text-padma">
          {a.product.title}
        </Link>
        {a.variantLabel && <p className="text-sm text-ink-soft">{a.variantLabel}</p>}
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="inline-flex items-center gap-1 text-sm font-medium text-ink">
            {a.type === 'PRICE_DROP' ? <TrendingDown className="size-4 text-padma" aria-hidden /> : <PackageCheck className="size-4 text-padma" aria-hidden />}
            {a.type === 'PRICE_DROP' ? 'Price drop' : 'Back in stock'}
          </span>
          {a.notifiedAt ? <Badge tone="green">Sent {relative(a.notifiedAt)}</Badge> : <Badge tone="amber">Waiting</Badge>}
        </div>
        {a.type === 'PRICE_DROP' ? (
          <p className="mt-1 text-sm text-ink-soft">
            {a.priceAtSubscribe != null && (
              <>
                <span className="whitespace-nowrap">You saw {tk(a.priceAtSubscribe)}</span> ·{' '}
              </>
            )}
            <span className={clsx('whitespace-nowrap', dropped ? 'font-semibold text-padma' : 'text-ink')}>now {tk(a.currentPrice)}</span>
          </p>
        ) : (
          <p className={clsx('mt-1 text-sm', a.inStock ? 'font-semibold text-padma' : 'text-ink-soft')}>{a.inStock ? 'In stock now' : 'Still sold out'}</p>
        )}
      </div>
      <div className="flex shrink-0 flex-col items-end justify-between gap-2">
        <AlertRemoveButton id={a.id} title={a.product.title} />
        {a.inStock && (a.notifiedAt || a.type === 'BACK_IN_STOCK') && (
          <Link href={href} className="text-sm font-semibold text-padma hover:underline">
            View item
          </Link>
        )}
      </div>
    </li>
  );
}
