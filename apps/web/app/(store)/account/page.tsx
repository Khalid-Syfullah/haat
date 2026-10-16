import { BellRing, Coins, CreditCard, LifeBuoy, MessageSquare, PackageCheck, Ticket, Truck, Undo2 } from 'lucide-react';
import Link from 'next/link';
import { OrderSummary, StatusBadge } from '@/components/store/order-bits';
import { date, tk } from '@/lib/format';
import { getMe, serverApi } from '@/lib/server';

interface OrderList {
  orders: OrderSummary[];
  counts: Record<string, number>;
}

export default async function AccountHome() {
  const [me, orders, vouchers, tickets, alerts] = await Promise.all([
    getMe(),
    serverApi<OrderList>('/orders'),
    serverApi<{ state: string }[]>('/vouchers/mine'),
    serverApi<{ status: string }[]>('/support/tickets'),
    serverApi<{ notifiedAt: string | null }[]>('/alerts'),
  ]);
  const counts = orders?.counts ?? {};
  const tiles = [
    { tab: 'to-pay', label: 'To pay', icon: CreditCard },
    { tab: 'to-ship', label: 'To ship', icon: PackageCheck },
    { tab: 'to-receive', label: 'To receive', icon: Truck },
    { tab: 'to-review', label: 'To review', icon: MessageSquare },
    { tab: 'returns', label: 'Returns and cancellations', icon: Undo2 },
  ];
  const usable = (vouchers ?? []).filter((v) => v.state === 'available').length;
  const replied = (tickets ?? []).filter((t) => t.status === 'PENDING').length;
  const watching = (alerts ?? []).filter((a) => !a.notifiedAt).length;

  return (
    <div className="space-y-4">
      <section className="rounded-[var(--radius-card)] border border-line bg-white p-4 sm:p-5">
        <h1 className="text-xl font-bold">Hello, {me.user?.name.split(' ')[0]}</h1>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Link href="/account/coins" className="flex items-center gap-3 rounded-md bg-marigold-tint p-3 hover:ring-1 hover:ring-marigold">
            <Coins className="size-6 text-marigold-dark" />
            <span>
              <span className="block text-xl font-bold leading-tight">{me.user?.coins ?? 0}</span>
              <span className="text-sm text-ink-soft">Coins to spend</span>
            </span>
          </Link>
          <Link href="/account/vouchers" className="flex items-center gap-3 rounded-md bg-padma-tint p-3 hover:ring-1 hover:ring-padma">
            <Ticket className="size-6 text-padma" />
            <span>
              <span className="block text-xl font-bold leading-tight">{usable}</span>
              <span className="text-sm text-ink-soft">Vouchers ready</span>
            </span>
          </Link>
          <Link href="/account/alerts" className="flex items-center gap-3 rounded-md bg-paper p-3 hover:ring-1 hover:ring-ink-faint">
            <BellRing className="size-6 text-padma" />
            <span>
              <span className="block text-xl font-bold leading-tight">{watching}</span>
              <span className="text-sm text-ink-soft">Price and stock alerts</span>
            </span>
          </Link>
          <Link href="/account/support" className="flex items-center gap-3 rounded-md bg-paper p-3 hover:ring-1 hover:ring-ink-faint">
            <LifeBuoy className="size-6 text-padma" />
            <span>
              <span className="block text-[15px] font-semibold leading-tight">Help and support</span>
              <span className={replied > 0 ? 'text-sm font-semibold text-padma' : 'text-sm text-ink-soft'}>
                {replied > 0 ? `We replied to ${replied}` : 'Ask us anything'}
              </span>
            </span>
          </Link>
        </div>
      </section>

      <section className="rounded-[var(--radius-card)] border border-line bg-white p-4 sm:p-5" aria-labelledby="orders-title">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="orders-title" className="text-lg font-semibold">
            My orders
          </h2>
          <Link href="/account/orders" className="text-[15px] font-semibold text-padma hover:underline">
            View all
          </Link>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {tiles.map(({ tab, label, icon: Icon }) => (
            <Link key={tab} href={`/account/orders?tab=${tab}`} className="relative flex flex-col items-center gap-1.5 rounded-md p-2 text-center text-sm hover:bg-paper">
              <Icon className="size-7 text-padma" strokeWidth={1.6} />
              <span className="leading-tight">{label}</span>
              {(counts[tab] ?? 0) > 0 && (
                <span className="absolute right-[calc(50%-26px)] top-0 min-w-5 rounded-full bg-sindoor px-1 text-center text-xs font-bold leading-5 text-white">{counts[tab]}</span>
              )}
            </Link>
          ))}
        </div>
      </section>

      {orders && orders.orders.length > 0 && (
        <section className="rounded-[var(--radius-card)] border border-line bg-white" aria-labelledby="recent-title">
          <h2 id="recent-title" className="border-b border-line px-4 py-3 text-lg font-semibold sm:px-5">
            Recent orders
          </h2>
          <ul className="divide-y divide-line">
            {orders.orders.slice(0, 4).map((o) => (
              <li key={o.orderNo}>
                <Link href={`/account/orders/${o.orderNo}`} className="flex items-center gap-3 px-4 py-3 hover:bg-paper sm:px-5">
                  <div className="flex -space-x-3">
                    {o.items.slice(0, 3).map((i) => (
                      <span key={i.id} className="size-12 overflow-hidden rounded border-2 border-white bg-paper">
                        {i.imageUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={i.imageUrl} alt="" className="size-full object-cover" />
                        )}
                      </span>
                    ))}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px]">{o.items.map((i) => i.title).join(', ')}</p>
                    <p className="text-sm text-ink-soft">
                      {o.orderNo}, {date(o.createdAt)}
                    </p>
                  </div>
                  <div className="text-right">
                    <StatusBadge status={o.status} />
                    <p className="mt-1 text-sm font-semibold">{tk(o.total)}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
