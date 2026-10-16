import { Users } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { flatParams, Panel, Table, TableWrap, Td, Th } from '@/components/admin/bits';
import { FilterToggle, SearchBox, Toolbar, UrlPagination } from '@/components/admin/controls';
import { CustomerToggles } from '@/components/admin/customer-toggles';
import { AdminHeader } from '@/components/admin/shell';
import { Badge, EmptyState } from '@/components/ui';
import { date, tk } from '@/lib/format';
import { mustGet } from '@/lib/server';

export const metadata: Metadata = { title: 'Customers' };

interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  coins: number;
  codBlocked: boolean;
  isActive: boolean;
  createdAt: string;
  orders: number;
  delivered: number;
  failed: number;
  cancelled: number;
  spent: number;
}

export default async function CustomersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = flatParams(await searchParams);
  const data = await mustGet<{ items: Customer[]; total: number; page: number; pages: number }>(`/admin/customers?${new URLSearchParams(sp)}`);
  const filtered = Boolean(sp.q || sp.codBlocked);

  return (
    <>
      <AdminHeader title="Customers" description={`${data.total} customer${data.total === 1 ? '' : 's'}${filtered ? ' match' : ''}`} />
      <Toolbar>
        <SearchBox placeholder="Name, phone or email" label="Search customers" />
        <FilterToggle param="codBlocked" label="Cash on delivery blocked" />
      </Toolbar>

      <Panel>
        {data.items.length === 0 ? (
          <EmptyState
            icon={<Users className="size-10" />}
            title={filtered ? 'No customers match' : 'No customers yet'}
            body={filtered ? 'Check the spelling, or search by the last digits of the phone number.' : 'Customers appear here after they register at checkout.'}
          />
        ) : (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Customer</Th>
                  <Th align="right">Orders</Th>
                  <Th align="right">Delivered</Th>
                  <Th align="right">Failed</Th>
                  <Th align="right">Cancelled</Th>
                  <Th align="right">Spent</Th>
                  <Th align="right">Coins</Th>
                  <Th>Joined</Th>
                  <Th>Restrictions</Th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((c) => {
                  const refusalRate = c.delivered + c.failed > 0 ? c.failed / (c.delivered + c.failed) : 0;
                  return (
                    <tr key={c.id} className="hover:bg-paper/60">
                      <Td className="min-w-48">
                        <span className="flex items-center gap-2">
                          <span className="font-medium text-ink">{c.name}</span>
                          {!c.isActive && <Badge tone="red">Disabled</Badge>}
                        </span>
                        <span className="block text-xs text-ink-soft tabular-nums">{c.phone}</span>
                        {c.email && <span className="block text-xs text-ink-soft">{c.email}</span>}
                      </Td>
                      <Td num>
                        {c.orders > 0 ? (
                          <Link href={`/admin/orders?q=${encodeURIComponent(c.phone)}`} className="font-medium text-padma hover:underline">
                            {c.orders}
                          </Link>
                        ) : (
                          0
                        )}
                      </Td>
                      <Td num>{c.delivered}</Td>
                      <Td num className={c.failed > 0 ? (refusalRate >= 0.3 ? 'font-semibold text-sindoor' : 'text-ink') : 'text-ink-faint'}>{c.failed}</Td>
                      <Td num className={c.cancelled > 0 ? 'text-ink' : 'text-ink-faint'}>
                        {c.cancelled}
                      </Td>
                      <Td num className="font-medium whitespace-nowrap">
                        {tk(c.spent)}
                      </Td>
                      <Td num>{c.coins}</Td>
                      <Td className="whitespace-nowrap text-ink-soft">{date(c.createdAt)}</Td>
                      <Td className="min-w-56">
                        <CustomerToggles id={c.id} name={c.name} codBlocked={c.codBlocked} isActive={c.isActive} />
                      </Td>
                    </tr>
                  );
                })}
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
