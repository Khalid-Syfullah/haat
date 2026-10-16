import clsx from 'clsx';
import { Package } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { OrderSummary, StatusBadge } from '@/components/store/order-bits';
import { EmptyState } from '@/components/ui';
import { date, PAYMENT_LABEL, tk } from '@/lib/format';
import { serverApi } from '@/lib/server';

export const metadata: Metadata = { title: 'My orders' };

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'to-pay', label: 'To pay' },
  { key: 'to-ship', label: 'To ship' },
  { key: 'to-receive', label: 'To receive' },
  { key: 'to-review', label: 'To review' },
  { key: 'returns', label: 'Returns and cancellations' },
];

interface OrderList {
  orders: OrderSummary[];
  total: number;
  page: number;
  pages: number;
  counts: Record<string, number>;
}

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ tab?: string; page?: string }> }) {
  const sp = await searchParams;
  const tab = TABS.some((t) => t.key === sp.tab) ? sp.tab! : 'all';
  const page = Number(sp.page) || 1;
  const data = await serverApi<OrderList>(`/orders?tab=${tab}&page=${page}`);

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-bold">My orders</h1>
      <nav className="no-scrollbar flex gap-1 overflow-x-auto rounded-[var(--radius-card)] border border-line bg-white p-1" aria-label="Order status">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/account/orders?tab=${t.key}`}
            aria-current={tab === t.key ? 'page' : undefined}
            className={clsx('shrink-0 rounded-md px-3 py-2 text-[15px] font-medium', tab === t.key ? 'bg-padma text-white' : 'text-ink-soft hover:bg-paper')}
          >
            {t.label}
            {t.key !== 'all' && (data?.counts[t.key] ?? 0) > 0 && <span className="ml-1.5 opacity-80">({data?.counts[t.key]})</span>}
          </Link>
        ))}
      </nav>

      {!data || data.orders.length === 0 ? (
        <div className="rounded-[var(--radius-card)] border border-line bg-white">
          <EmptyState
            icon={<Package className="size-12" />}
            title={tab === 'all' ? 'No orders yet' : 'Nothing here right now'}
            body={tab === 'all' ? 'Your orders and their delivery status will show up here.' : 'Orders move between these tabs as they progress.'}
            action={
              <Link href="/" className="rounded-md bg-padma px-5 py-2.5 font-semibold text-white hover:bg-padma-dark">
                Continue shopping
              </Link>
            }
          />
        </div>
      ) : (
        <ul className="space-y-3">
          {data.orders.map((o) => (
            <li key={o.orderNo} className="rounded-[var(--radius-card)] border border-line bg-white">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line px-4 py-2.5 text-sm">
                <Link href={`/account/orders/${o.orderNo}`} className="font-semibold text-padma hover:underline">
                  Order {o.orderNo}
                </Link>
                <span className="text-ink-soft">Placed {date(o.createdAt)}</span>
                <span className="text-ink-soft">{PAYMENT_LABEL[o.paymentMethod]}</span>
                <span className="ml-auto">
                  <StatusBadge status={o.status} />
                </span>
              </div>
              <ul className="divide-y divide-line">
                {o.items.map((i) => (
                  <li key={i.id} className="flex items-center gap-3 px-4 py-3">
                    <span className="size-14 shrink-0 overflow-hidden rounded bg-paper">
                      {i.imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={i.imageUrl} alt="" className="size-full object-cover" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1 text-[15px]">
                      <p className="line-clamp-1">{i.title}</p>
                      <p className="text-sm text-ink-soft">
                        {i.variantLabel ? `${i.variantLabel}, ` : ''}qty {i.quantity}
                      </p>
                    </div>
                    <span className="text-[15px]">{tk(i.unitPrice * i.quantity)}</span>
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap items-center justify-end gap-3 border-t border-line px-4 py-2.5">
                <span className="mr-auto text-[15px]">
                  Total <span className="font-bold">{tk(o.total)}</span>
                </span>
                {o.status === 'AWAITING_PAYMENT' && (
                  <Link href={`/account/orders/${o.orderNo}`} className="rounded-md bg-marigold px-4 py-1.5 text-sm font-semibold text-ink hover:bg-[#e09d00]">
                    Pay now
                  </Link>
                )}
                {o.status === 'DELIVERED' && o.items.some((i) => !i.reviewed) && (
                  <Link href="/account/reviews" className="rounded-md bg-padma-tint px-4 py-1.5 text-sm font-semibold text-padma-dark">
                    Write a review
                  </Link>
                )}
                <Link href={`/account/orders/${o.orderNo}`} className="rounded-md border border-line px-4 py-1.5 text-sm font-semibold hover:border-ink-faint">
                  View details
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}

      {data && data.pages > 1 && (
        <nav className="flex justify-center gap-2" aria-label="Pages">
          {page > 1 && (
            <Link href={`/account/orders?tab=${tab}&page=${page - 1}`} className="rounded-md border border-line bg-white px-3 py-1.5 text-sm font-semibold">
              Previous
            </Link>
          )}
          <span className="px-2 py-1.5 text-sm text-ink-soft">
            Page {page} of {data.pages}
          </span>
          {page < data.pages && (
            <Link href={`/account/orders?tab=${tab}&page=${page + 1}`} className="rounded-md border border-line bg-white px-3 py-1.5 text-sm font-semibold">
              Next
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
