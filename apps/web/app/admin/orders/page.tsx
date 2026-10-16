import { ClipboardList, PhoneCall } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import {
  flatParams,
  hrefWith,
  LinkTabs,
  ORDER_STATUSES,
  OrderStatusBadge,
  Panel,
  paymentLabel,
  PaymentStatusBadge,
  RiskBadge,
  Table,
  TableWrap,
  Td,
  Th,
} from '@/components/admin/bits';
import { FilterSelect, FilterToggle, SearchBox, Toolbar, UrlPagination } from '@/components/admin/controls';
import { AdminHeader } from '@/components/admin/shell';
import { EmptyState } from '@/components/ui';
import { dateTime, ORDER_STATUS_LABEL, PAYMENT_LABEL, PAYMENT_STATUS_LABEL, tk } from '@/lib/format';
import { mustGet, serverApi } from '@/lib/server';

export const metadata: Metadata = { title: 'Orders' };

interface OrderRow {
  id: string;
  orderNo: string;
  status: string;
  paymentMethod: string;
  paymentStatus: string;
  total: number;
  itemCount: number;
  customer: string;
  phone: string;
  district: string;
  riskScore: number;
  needsCall: boolean;
  createdAt: string;
}

interface OrderList {
  items: OrderRow[];
  total: number;
  page: number;
  pages: number;
  statusCounts: Record<string, number>;
}

export default async function OrdersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = flatParams(await searchParams);
  const qs = new URLSearchParams({ ...sp, limit: '25' });
  const [data, settings] = await Promise.all([
    mustGet<OrderList>(`/admin/orders?${qs}`),
    serverApi<{ cod: { callThreshold: number; advanceThreshold: number } }>('/admin/settings'),
  ]);
  const callAt = settings?.cod.callThreshold ?? 40;
  const advanceAt = settings?.cod.advanceThreshold ?? 70;
  const all = Object.values(data.statusCounts).reduce((a, b) => a + b, 0);
  const active = sp.status && sp.status in ORDER_STATUS_LABEL ? sp.status : 'all';
  const filtered = Boolean(sp.q || sp.payment || sp.paymentStatus || sp.needsCall);

  const tabs = [
    { key: 'all', label: 'All', count: all, href: hrefWith('/admin/orders', sp, { status: null, page: null }) },
    ...ORDER_STATUSES.map((s) => ({
      key: s,
      label: ORDER_STATUS_LABEL[s],
      count: data.statusCounts[s] ?? 0,
      href: hrefWith('/admin/orders', sp, { status: s, page: null }),
    })),
  ];

  return (
    <>
      <AdminHeader title="Orders" description={`${data.total} order${data.total === 1 ? '' : 's'}${filtered || active !== 'all' ? ' match these filters' : ''}`} />

      <LinkTabs tabs={tabs} active={active} label="Order status" />

      <Toolbar>
        <SearchBox placeholder="Order no, phone, name or tracking" label="Search orders" />
        <FilterSelect
          param="payment"
          label="Payment"
          allLabel="All methods"
          options={Object.entries(PAYMENT_LABEL).map(([value, label]) => ({ value, label }))}
        />
        <FilterSelect
          param="paymentStatus"
          label="Payment status"
          allLabel="Any status"
          options={Object.entries(PAYMENT_STATUS_LABEL).map(([value, label]) => ({ value, label }))}
        />
        <FilterToggle param="needsCall" label="Needs a call" />
      </Toolbar>

      <Panel>
        {data.items.length === 0 ? (
          <EmptyState
            icon={<ClipboardList className="size-10" />}
            title={filtered || active !== 'all' ? 'No orders match' : 'No orders yet'}
            body={
              filtered || active !== 'all'
                ? 'Try another status tab, or clear the search and filters.'
                : 'Orders appear here the moment a customer checks out.'
            }
            action={
              (filtered || active !== 'all') && (
                <Link href="/admin/orders" className="inline-flex h-10 items-center rounded-md border border-line px-4 font-semibold text-ink hover:border-ink-faint">
                  Clear filters
                </Link>
              )
            }
          />
        ) : (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Order</Th>
                  <Th>Placed</Th>
                  <Th>Customer</Th>
                  <Th>District</Th>
                  <Th align="right">Items</Th>
                  <Th align="right">Total</Th>
                  <Th>Payment</Th>
                  <Th>COD risk</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((o) => (
                  <tr key={o.id} className="group relative hover:bg-paper/70">
                    <Td className="whitespace-nowrap">
                      {/* The link's ::after stretches over the row so the whole row opens the order. */}
                      <Link href={`/admin/orders/${o.id}`} className="font-semibold text-padma after:absolute after:inset-0 hover:underline">
                        {o.orderNo}
                      </Link>
                      {o.needsCall && (
                        <span className="ml-2 inline-flex items-center gap-1 text-xs font-medium text-marigold-dark">
                          <PhoneCall className="size-3.5" aria-hidden /> Call
                        </span>
                      )}
                    </Td>
                    <Td className="whitespace-nowrap text-ink-soft">{dateTime(o.createdAt)}</Td>
                    <Td className="whitespace-nowrap">
                      <span className="block text-ink">{o.customer}</span>
                      <span className="block text-xs text-ink-soft tabular-nums">{o.phone}</span>
                    </Td>
                    <Td className="whitespace-nowrap text-ink-soft">{o.district}</Td>
                    <Td num>{o.itemCount}</Td>
                    <Td num className="font-medium whitespace-nowrap">
                      {tk(o.total)}
                    </Td>
                    <Td className="whitespace-nowrap">
                      <span className="mr-2 text-ink-soft">{paymentLabel(o.paymentMethod)}</span>
                      <PaymentStatusBadge status={o.paymentStatus} />
                    </Td>
                    <Td>{o.paymentMethod === 'COD' ? <RiskBadge score={o.riskScore} callAt={callAt} advanceAt={advanceAt} /> : <span className="text-ink-faint">Prepaid</span>}</Td>
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
      <div className="mt-4">
        <UrlPagination page={data.page} pages={data.pages} />
      </div>
    </>
  );
}
