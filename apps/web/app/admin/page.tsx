import clsx from 'clsx';
import { Banknote, Boxes, ChevronRight, MessageCircleQuestion, PackageCheck, PhoneCall, Truck, Undo2, Warehouse } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { OrderStatusBadge, Panel, paymentLabel, Table, TableWrap, Td, Th } from '@/components/admin/bits';
import { RevenueChart } from '@/components/admin/revenue-chart';
import { AdminHeader } from '@/components/admin/shell';
import { Badge, EmptyState } from '@/components/ui';
import { dateTime, tk } from '@/lib/format';
import { mustGet } from '@/lib/server';

export const metadata: Metadata = { title: 'Dashboard' };

interface Dashboard {
  today: { orders: number; revenue: number };
  last30: { orders: number; revenue: number; days: { day: string; orders: number; revenue: number }[] };
  queues: { toCall: number; toPack: number; toShip: number; inTransit: number; returns: number; refunds: number; unanswered: number };
  lowStock: { id: string; sku: string; stock: number; lowStockThreshold: number; title: string; productId: string; label: string | null }[];
  recentOrders: { id: string; orderNo: string; status: string; total: number; customer: string; paymentMethod: string; createdAt: string }[];
}

const QUEUES: { key: keyof Dashboard['queues']; label: string; hint: string; href: string; icon: typeof PhoneCall }[] = [
  { key: 'toCall', label: 'To call', hint: 'New orders to confirm by phone', href: '/admin/orders?status=PLACED', icon: PhoneCall },
  { key: 'toPack', label: 'To pack', hint: 'Confirmed, waiting to be packed', href: '/admin/orders?status=CONFIRMED', icon: Boxes },
  { key: 'toShip', label: 'To ship', hint: 'Packed, hand to a courier', href: '/admin/orders?status=PACKED', icon: PackageCheck },
  { key: 'inTransit', label: 'In transit', hint: 'With the courier now', href: '/admin/orders?status=SHIPPED', icon: Truck },
  { key: 'returns', label: 'Returns', hint: 'Requested or received back', href: '/admin/returns', icon: Undo2 },
  { key: 'refunds', label: 'Refunds due', hint: 'Prepaid orders to refund', href: '/admin/orders?paymentStatus=REFUND_PENDING', icon: Banknote },
  { key: 'unanswered', label: 'Unanswered questions', hint: 'Customers waiting on product answers', href: '/admin/questions?unanswered=true', icon: MessageCircleQuestion },
];

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-[6px] border border-line bg-white px-4 py-3">
      <p className="text-sm text-ink-soft">{label}</p>
      <p className="mt-0.5 text-2xl font-bold text-ink">{value}</p>
      <p className="text-sm text-ink-soft">{sub}</p>
    </div>
  );
}

export default async function AdminHome() {
  const d = await mustGet<Dashboard>('/admin/dashboard');
  const avg = d.last30.orders ? d.last30.revenue / d.last30.orders : 0;

  return (
    <>
      <AdminHeader title="Dashboard" description="Today at a glance and what needs doing next." />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Orders today" value={String(d.today.orders)} sub="Since midnight, Dhaka time" />
        <Stat label="Revenue today" value={tk(d.today.revenue)} sub="Excludes cancelled and failed" />
        <Stat label="Orders, last 30 days" value={String(d.last30.orders)} sub={`Average order ${tk(avg)}`} />
        <Stat label="Revenue, last 30 days" value={tk(d.last30.revenue)} sub="Excludes cancelled and failed" />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Panel title="Revenue, last 30 days" description="Daily order value, Dhaka time" bodyClassName="px-4 pt-3 pb-4">
          <RevenueChart days={d.last30.days} />
        </Panel>

        <Panel title="To do" bodyClassName="divide-y divide-line">
          {QUEUES.map(({ key, label, hint, href, icon: Icon }) => {
            const n = d.queues[key];
            return (
              <Link
                key={key}
                href={href}
                className="group flex items-center gap-3 px-4 py-2.5 hover:bg-paper focus-visible:bg-paper"
              >
                <Icon className={clsx('size-[18px] shrink-0', n ? 'text-padma' : 'text-ink-faint')} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className={clsx('block text-[15px] font-medium', n ? 'text-ink' : 'text-ink-soft')}>{label}</span>
                  <span className="block truncate text-xs text-ink-soft">{hint}</span>
                </span>
                {n > 0 ? (
                  <Badge tone={key === 'refunds' || key === 'toCall' ? 'amber' : key === 'inTransit' ? 'blue' : 'neutral'} className="tabular-nums">
                    {n}
                  </Badge>
                ) : (
                  <span className="text-sm text-ink-faint tabular-nums">0</span>
                )}
                <ChevronRight className="size-4 text-ink-faint group-hover:text-ink" aria-hidden />
              </Link>
            );
          })}
        </Panel>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Panel
          title="Recent orders"
          actions={
            <Link href="/admin/orders" className="text-sm font-medium text-padma hover:underline">
              All orders
            </Link>
          }
        >
          {d.recentOrders.length === 0 ? (
            <EmptyState title="No orders yet" body="New orders from the store show up here as soon as they are placed." />
          ) : (
            <TableWrap>
              <Table>
                <thead>
                  <tr>
                    <Th>Order</Th>
                    <Th>Placed</Th>
                    <Th>Customer</Th>
                    <Th>Payment</Th>
                    <Th align="right">Total</Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody>
                  {d.recentOrders.map((o) => (
                    <tr key={o.id} className="hover:bg-paper/60">
                      <Td>
                        <Link href={`/admin/orders/${o.id}`} className="font-semibold text-padma hover:underline">
                          {o.orderNo}
                        </Link>
                      </Td>
                      <Td className="whitespace-nowrap text-ink-soft">{dateTime(o.createdAt)}</Td>
                      <Td className="whitespace-nowrap">{o.customer}</Td>
                      <Td className="whitespace-nowrap text-ink-soft">{paymentLabel(o.paymentMethod)}</Td>
                      <Td num className="font-medium">
                        {tk(o.total)}
                      </Td>
                      <Td>
                        <OrderStatusBadge status={o.status} />
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          )}
        </Panel>

        <Panel
          title="Low stock"
          actions={
            <Link href="/admin/inventory?lowOnly=true" className="text-sm font-medium text-padma hover:underline">
              Inventory
            </Link>
          }
          bodyClassName="divide-y divide-line"
        >
          {d.lowStock.length === 0 ? (
            <EmptyState icon={<Warehouse className="size-10" />} title="Stock looks healthy" body="Variants at or below their low-stock threshold will be listed here." />
          ) : (
            d.lowStock.map((v) => (
              <Link key={v.id} href={`/admin/inventory?q=${encodeURIComponent(v.sku)}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-paper">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink">{v.title}</span>
                  <span className="block truncate text-xs text-ink-soft">
                    {v.label ? `${v.label}, ` : ''}
                    {v.sku}
                  </span>
                </span>
                <Badge tone={v.stock === 0 ? 'red' : 'amber'} className="tabular-nums">
                  {v.stock === 0 ? 'Out of stock' : `${v.stock} left`}
                </Badge>
              </Link>
            ))
          )}
        </Panel>
      </div>
    </>
  );
}
