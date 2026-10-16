import clsx from 'clsx';
import { ChartNoAxesCombined, Info, Package, TicketPercent, Undo2 } from 'lucide-react';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { flatParams, hrefWith, LinkTabs, Panel, RETURN_STATUSES, ReturnStatusBadge, Table, TableWrap, Td, Th } from '@/components/admin/bits';
import { CategoryTable, type CategoryLine } from '@/components/admin/reports/category-table';
import { DailyChart } from '@/components/admin/reports/daily-chart';
import { Change, CsvLink, pct, ShareBar, Tile } from '@/components/admin/reports/parts';
import { RangePicker } from '@/components/admin/reports/range-picker';
import { rangeLabel, resolveRange } from '@/components/admin/reports/range';
import { AdminHeader } from '@/components/admin/shell';
import { Badge, EmptyState } from '@/components/ui';
import { tk } from '@/lib/format';
import { mustGet } from '@/lib/server';

export const metadata: Metadata = { title: 'Reports' };

interface Summary {
  range: { from: string; to: string; days: number };
  orders: number;
  revenue: number;
  units: number;
  averageOrder: number;
  deliveredOrders: number;
  deliveredRevenue: number;
  discounts: number;
  coinsRedeemed: number;
  deliveryCharged: number;
  codShare: number;
  customers: number;
  newCustomers: number;
  placed: number;
  cancelled: number;
  failedDeliveries: number;
  cancelRate: number;
  failedRate: number;
  previous: { orders: number; revenue: number; ordersChange: number | null; revenueChange: number | null };
  days: { day: string; orders: number; revenue: number }[];
}

interface ProductLine {
  productId: string;
  title: string;
  slug: string;
  orders: number;
  units: number;
  revenue: number;
  deliveredUnits: number;
  returnedUnits: number;
  returnRate: number;
}

interface VoucherLine {
  voucherId: string;
  code: string;
  title: string;
  type: string;
  uses: number;
  customers: number;
  discount: number;
  revenue: number;
  deliveredRevenue: number;
  averageOrder: number;
  returnOnSpend: number | null;
}

interface ReturnsReport {
  requests: number;
  units: number;
  deliveredUnits: number;
  returnRate: number;
  refunded: number;
  byStatus: Record<string, number>;
  byReason: { reason: string; requests: number; units: number }[];
  products: ProductLine[];
}

const TABS = [
  { key: 'categories', label: 'Categories' },
  { key: 'products', label: 'Best sellers' },
  { key: 'vouchers', label: 'Vouchers' },
  { key: 'returns', label: 'Returns' },
] as const;
type Tab = (typeof TABS)[number]['key'];

const VOUCHER_TYPE: Record<string, string> = { PERCENT: 'Percent off', FIXED: 'Taka off', FREE_SHIPPING: 'Free delivery' };

/** 8.4 → "৳8.4 per ৳1" */
function perTaka(n: number) {
  return `৳${Number.isInteger(n) ? n : n.toFixed(1)} per ৳1`;
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = flatParams(await searchParams);
  const r = resolveRange(sp);
  const tab: Tab = TABS.find((t) => t.key === sp.tab)?.key ?? 'categories';
  const sort = sp.sort === 'returns' ? 'returns' : 'revenue';
  const q = new URLSearchParams({ from: r.from, to: r.to }).toString();
  const csv = (name: string) => `/api/admin/reports/export/${name}?${q}`;
  // What the URL says about dates, kept as-is when switching tabs
  const dates = r.error ? {} : { range: sp.range, from: sp.from, to: sp.to };

  const [s, section] = await Promise.all([
    mustGet<Summary>(`/admin/reports/summary?${q}`),
    tab === 'categories'
      ? mustGet<{ totalRevenue: number; items: (CategoryLine & { children: CategoryLine[] })[] }>(`/admin/reports/categories?${q}`)
      : tab === 'products'
        ? mustGet<{ items: ProductLine[] }>(`/admin/reports/products?${q}&limit=50&sort=${sort}`)
        : tab === 'vouchers'
          ? mustGet<{ items: VoucherLine[] }>(`/admin/reports/vouchers?${q}`)
          : mustGet<ReturnsReport>(`/admin/reports/returns?${q}`),
  ]);
  const days = s.range.days;
  const hasSales = s.days.some((d) => d.revenue > 0);

  return (
    <>
      <AdminHeader
        title="Reports"
        description={`${rangeLabel(r.from, r.to)}, ${days} day${days === 1 ? '' : 's'}, Dhaka time`}
        actions={<CsvLink href={csv('orders')} button>Export orders (CSV)</CsvLink>}
      />

      <RangePicker key={`${r.from}:${r.to}`} from={r.from} to={r.to} active={r.active} today={r.today} keep={{ tab: tab === 'categories' ? undefined : tab, sort: sp.sort }} />

      {r.error && (
        <p className="mb-4 rounded-[6px] border border-marigold/40 bg-marigold-tint px-4 py-2.5 text-sm text-ink" role="alert">
          {r.error}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Revenue" value={tk(s.revenue)} sub={<Change value={s.previous.revenueChange} days={days} />} />
        <Tile label="Orders" value={s.orders} sub={<Change value={s.previous.ordersChange} days={days} />} />
        <Tile label="Average order" value={tk(s.averageOrder)} sub={`${s.deliveredOrders} of ${s.orders} delivered`} />
        <Tile label="Units sold" value={s.units} sub={`To ${s.customers} customer${s.customers === 1 ? '' : 's'}`} />
        <Tile label="New customers" value={s.newCustomers} sub="Placed their first order" />
        <Tile
          label="Cancellation rate"
          value={pct(s.cancelRate)}
          tone={s.cancelRate >= 10 ? 'red' : undefined}
          sub={`${s.cancelled} of ${s.placed} order${s.placed === 1 ? '' : 's'} cancelled`}
        />
        <Tile
          label="Failed delivery rate"
          value={pct(s.failedRate)}
          tone={s.failedRate >= 10 ? 'red' : undefined}
          sub={`${s.failedDeliveries} refused or not delivered`}
        />
        <Tile label="Cash on delivery share" value={pct(s.codShare)} sub="Of orders paid in cash" />
      </div>
      <p className="mt-2 flex items-start gap-1.5 text-sm text-ink-soft">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
        Item and order values before refunds. Cancelled, refused and unpaid orders are left out.
      </p>

      <Panel
        className="mt-4"
        title={days > 120 ? 'Revenue by week' : 'Revenue by day'}
        description={days > 120 ? 'Order value per week, Dhaka time' : 'Order value per day, Dhaka time'}
        bodyClassName="px-4 pt-3 pb-4"
      >
        {hasSales ? (
          <DailyChart days={s.days} today={r.today} />
        ) : (
          <EmptyState icon={<ChartNoAxesCombined className="size-10" />} title="No sales in these dates" body="Daily revenue will appear here once orders come in. Try a longer date range." />
        )}
        <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 border-t border-line pt-3 text-sm sm:grid-cols-4">
          <Fact label="Delivered revenue">{tk(s.deliveredRevenue)}</Fact>
          <Fact label="Voucher discounts">{tk(s.discounts)}</Fact>
          <Fact label="Coins redeemed">{tk(s.coinsRedeemed)}</Fact>
          <Fact label="Delivery charged">{tk(s.deliveryCharged)}</Fact>
        </dl>
      </Panel>

      <div className="mt-6">
        <LinkTabs
          label="Report sections"
          active={tab}
          tabs={TABS.map((t) => ({ key: t.key, label: t.label, href: hrefWith('/admin/reports', dates, { tab: t.key === 'categories' ? null : t.key }) }))}
        />

        {tab === 'categories' && 'totalRevenue' in section && (
          <Panel
            title="Sales by category"
            description="Item value before order discounts. Open a category to see its sub-categories."
            actions={<CsvLink href={csv('categories')} />}
          >
            {section.items.length === 0 ? (
              <EmptyState icon={<Package className="size-10" />} title="No sales in these dates" body="Each category's orders, units and revenue will appear here once orders come in." />
            ) : (
              <CategoryTable items={section.items} />
            )}
          </Panel>
        )}

        {tab === 'products' && 'items' in section && (
          <Panel
            title="Best sellers"
            description={sort === 'returns' ? 'Products sent back most often first' : 'Products that brought in the most first'}
            actions={
              <>
                <nav className="inline-flex rounded-md border border-line p-0.5" aria-label="Sort best sellers">
                  {(
                    [
                      ['revenue', 'By revenue'],
                      ['returns', 'By returns'],
                    ] as const
                  ).map(([key, label]) => (
                    <Link
                      key={key}
                      href={hrefWith('/admin/reports', { ...dates, tab: 'products' }, { sort: key === 'revenue' ? null : key })}
                      aria-current={sort === key ? 'true' : undefined}
                      className={clsx('rounded px-2.5 py-1 text-sm font-medium', sort === key ? 'bg-padma text-white' : 'text-ink-soft hover:text-ink')}
                    >
                      {label}
                    </Link>
                  ))}
                </nav>
                <CsvLink href={csv('products')} />
              </>
            }
          >
            {(section.items as ProductLine[]).length === 0 ? (
              <EmptyState icon={<Package className="size-10" />} title="No products sold in these dates" body="Your best-selling products and how often they come back will appear here." />
            ) : (
              <>
                <ProductTable items={section.items as ProductLine[]} />
                <p className="px-4 py-3 text-xs text-ink-soft">
                  Return rate is units sent back out of units delivered, for orders placed in these dates. Rejected returns don&apos;t count. 10% or more is marked in red.
                </p>
              </>
            )}
          </Panel>
        )}

        {tab === 'vouchers' && 'items' in section && (
          <Panel
            title="Vouchers"
            description="Orders that used each code. Return on spend is order revenue for each taka of discount."
            actions={<CsvLink href={csv('vouchers')} />}
          >
            {(section.items as VoucherLine[]).length === 0 ? (
              <EmptyState
                icon={<TicketPercent className="size-10" />}
                title="No vouchers used in these dates"
                body="Each code's uses, discount given and the sales it brought in will appear here once customers use one at checkout."
              />
            ) : (
              <VoucherTable items={section.items as VoucherLine[]} />
            )}
          </Panel>
        )}

        {tab === 'returns' && 'byReason' in section && <ReturnsSection data={section} csvHref={csv('returns')} />}
      </div>
    </>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-ink-soft">{label}</dt>
      <dd className="font-semibold text-ink tabular-nums">{children}</dd>
    </div>
  );
}

function ReturnRate({ p }: { p: ProductLine }) {
  if (p.deliveredUnits === 0) return <span className="text-xs text-ink-faint">None delivered</span>;
  if (p.returnRate >= 10) return <Badge tone="red" className="tabular-nums">{pct(p.returnRate)}</Badge>;
  return <span className="tabular-nums">{pct(p.returnRate)}</span>;
}

function ProductTable({ items }: { items: ProductLine[] }) {
  return (
    <TableWrap>
      <Table>
        <thead>
          <tr>
            <Th>Product</Th>
            <Th align="right">Orders</Th>
            <Th align="right">Units</Th>
            <Th align="right">Revenue</Th>
            <Th align="right">Delivered</Th>
            <Th align="right">Returned</Th>
            <Th align="right">Return rate</Th>
          </tr>
        </thead>
        <tbody>
          {items.map((p, i) => (
            <tr key={p.productId} className={clsx('hover:bg-paper/60', p.returnRate >= 10 && p.deliveredUnits > 0 && 'bg-sindoor-tint/40')}>
              <Td className="min-w-56">
                <span className="flex items-baseline gap-2">
                  <span className="w-5 shrink-0 text-right text-xs text-ink-faint tabular-nums">{i + 1}</span>
                  <Link href={`/admin/products/${p.productId}`} className="font-medium text-ink hover:text-padma hover:underline">
                    {p.title}
                  </Link>
                </span>
              </Td>
              <Td num>{p.orders}</Td>
              <Td num>{p.units}</Td>
              <Td num className="font-medium whitespace-nowrap">
                {tk(p.revenue)}
              </Td>
              <Td num>{p.deliveredUnits}</Td>
              <Td num className={clsx(p.returnedUnits > 0 && 'font-semibold text-ink')}>
                {p.returnedUnits}
              </Td>
              <Td num className="whitespace-nowrap">
                <ReturnRate p={p} />
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </TableWrap>
  );
}

function VoucherTable({ items }: { items: VoucherLine[] }) {
  return (
    <TableWrap>
      <Table>
        <thead>
          <tr>
            <Th>Voucher</Th>
            <Th align="right">Uses</Th>
            <Th align="right">Customers</Th>
            <Th align="right">Discount given</Th>
            <Th align="right">Order revenue</Th>
            <Th align="right">Delivered</Th>
            <Th align="right">Average order</Th>
            <Th align="right">Return on spend</Th>
          </tr>
        </thead>
        <tbody>
          {items.map((v) => (
            <tr key={v.voucherId} className="hover:bg-paper/60">
              <Td className="min-w-48">
                <span className="font-mono text-sm font-semibold text-ink">{v.code}</span>
                <span className="block text-xs text-ink-soft">
                  {v.title}, {VOUCHER_TYPE[v.type] ?? v.type}
                </span>
              </Td>
              <Td num>{v.uses}</Td>
              <Td num>{v.customers}</Td>
              <Td num className="whitespace-nowrap">
                {tk(v.discount)}
              </Td>
              <Td num className="font-medium whitespace-nowrap">
                {tk(v.revenue)}
              </Td>
              <Td num className="whitespace-nowrap">
                {tk(v.deliveredRevenue)}
              </Td>
              <Td num className="whitespace-nowrap">
                {tk(v.averageOrder)}
              </Td>
              <Td num className="whitespace-nowrap">
                {v.returnOnSpend === null ? <span className="text-xs text-ink-faint">No discount given</span> : <span className="font-semibold text-ink">{perTaka(v.returnOnSpend)}</span>}
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </TableWrap>
  );
}

function ReturnsSection({ data, csvHref }: { data: ReturnsReport; csvHref: string }) {
  const maxReason = Math.max(1, ...data.byReason.map((x) => x.requests));
  const statuses = RETURN_STATUSES.filter((st) => data.byStatus[st]);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-ink-soft">Return requests customers made in these dates.</p>
        <CsvLink href={csvHref}>Download returns CSV</CsvLink>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Return requests" value={data.requests} sub={statuses.length ? `${data.byStatus.REJECTED ?? 0} rejected` : 'None in these dates'} />
        <Tile label="Units returned" value={data.units} sub="Not counting rejected requests" />
        <Tile
          label="Return rate"
          value={pct(data.returnRate)}
          tone={data.returnRate >= 10 ? 'red' : data.returnRate >= 5 ? 'amber' : undefined}
          sub={`Of ${data.deliveredUnits} units delivered`}
        />
        <Tile label="Refunded" value={tk(data.refunded)} sub="Paid back to customers" />
      </div>

      {statuses.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-ink-soft">By status:</span>
          {statuses.map((st) => (
            <span key={st} className="inline-flex items-center gap-1.5 rounded-md border border-line bg-white px-2 py-1">
              <ReturnStatusBadge status={st} />
              <span className="font-semibold tabular-nums">{data.byStatus[st]}</span>
            </span>
          ))}
          <Link href="/admin/returns" className="font-medium text-padma hover:underline">
            Open returns
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 2xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Panel title="Why customers returned" description="Not counting rejected requests" bodyClassName="px-4 py-3">
          {data.byReason.length === 0 ? (
            <EmptyState icon={<Undo2 className="size-10" />} title="No returns in these dates" body="The reasons customers give for sending items back will appear here." />
          ) : (
            <ul className="space-y-3">
              {data.byReason.map((x) => (
                <li key={x.reason}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="min-w-0 font-medium text-ink">{x.reason}</span>
                    <span className="shrink-0 text-ink-soft tabular-nums">
                      {x.requests} request{x.requests === 1 ? '' : 's'}, {x.units} unit{x.units === 1 ? '' : 's'}
                    </span>
                  </div>
                  <ShareBar value={(x.requests / maxReason) * 100} className="mt-1 w-full! sm:w-full!" />
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Products returned most" description="Units sent back out of units delivered, for orders in these dates">
          {data.products.length === 0 ? (
            <EmptyState icon={<Package className="size-10" />} title="No products came back" body="Products with returns from orders in these dates will appear here, most returned first." />
          ) : (
            <ProductTable items={data.products} />
          )}
        </Panel>
      </div>
    </div>
  );
}
