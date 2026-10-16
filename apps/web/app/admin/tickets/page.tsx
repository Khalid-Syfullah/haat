import clsx from 'clsx';
import { LifeBuoy } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { flatParams, hrefWith, LinkTabs, Panel, Table, TableWrap, Td, Th } from '@/components/admin/bits';
import { FilterSelect, SearchBox, Toolbar, UrlPagination } from '@/components/admin/controls';
import { AdminHeader } from '@/components/admin/shell';
import { TICKET_STATUS_LABEL, TicketList, TicketListItem, TicketStatusBadge, UrgentBadge, waitFor } from '@/components/admin/ticket-bits';
import { EmptyState } from '@/components/ui';
import { relative } from '@/lib/format';
import { mustGet } from '@/lib/server';

export const metadata: Metadata = { title: 'Support tickets' };

const DAY = 24 * 60 * 60 * 1000;

const EMPTY: Record<string, { title: string; body: string }> = {
  OPEN: { title: 'No one is waiting on you', body: 'Every customer has an answer. New requests and customer replies land here.' },
  PENDING: { title: 'Nothing waiting on customers', body: 'Tickets you replied to stay here until the customer answers or you resolve them.' },
  RESOLVED: { title: 'No resolved tickets', body: 'Resolved tickets are kept here for your records.' },
  all: { title: 'No support tickets yet', body: 'When a customer asks for help from their account, the request lands here.' },
};

export default async function TicketsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = flatParams(await searchParams);
  // "Needs reply" is the working queue, so it is the default view.
  const status = sp.status === 'all' ? 'all' : sp.status && sp.status in TICKET_STATUS_LABEL ? sp.status : 'OPEN';
  const query = new URLSearchParams();
  if (status !== 'all') query.set('status', status);
  for (const key of ['assignee', 'category', 'q', 'page']) if (sp[key]) query.set(key, sp[key]);
  const data = await mustGet<TicketList>(`/admin/tickets?${query}`);

  const open = data.counts.OPEN ?? 0;
  const pending = data.counts.PENDING ?? 0;
  const resolved = data.counts.RESOLVED ?? 0;
  const filtered = Boolean(sp.q || sp.assignee || sp.category);
  const now = Date.now();

  const tabs = [
    { key: 'OPEN', label: 'Needs reply', count: open },
    { key: 'PENDING', label: 'Waiting on customer', count: pending },
    { key: 'RESOLVED', label: 'Resolved', count: resolved },
    { key: 'all', label: 'All', count: open + pending + resolved },
  ].map((t) => ({ ...t, href: hrefWith('/admin/tickets', sp, { status: t.key === 'OPEN' ? null : t.key, page: null }) }));

  const description =
    `${open} need${open === 1 ? 's' : ''} a reply, ${pending} waiting on the customer.` + (data.mineOpen > 0 ? ` ${data.mineOpen} of yours need a reply.` : '');
  const empty = filtered ? { title: 'No tickets match', body: 'Try another tab, or clear the search and filters.' } : EMPTY[status];

  return (
    <>
      <AdminHeader title="Support tickets" description={description} />
      <LinkTabs tabs={tabs} active={status} label="Ticket status" />

      <Toolbar>
        <SearchBox placeholder="Ticket, subject, phone, name or order no" label="Search tickets" />
        <FilterSelect param="category" label="Topic" allLabel="All topics" options={data.categories} />
        <FilterSelect
          param="assignee"
          label="Assigned"
          allLabel="Anyone"
          options={[
            { value: 'me', label: `Assigned to me${data.mineOpen ? ` (${data.mineOpen} need reply)` : ''}` },
            { value: 'none', label: 'Unassigned' },
          ]}
        />
      </Toolbar>

      <Panel>
        {data.items.length === 0 ? (
          <EmptyState
            icon={<LifeBuoy className="size-10" />}
            title={empty.title}
            body={empty.body}
            action={
              filtered && (
                <Link
                  href={hrefWith('/admin/tickets', {}, { status: status === 'OPEN' ? null : status })}
                  className="inline-flex h-10 items-center rounded-md border border-line px-4 font-semibold text-ink hover:border-ink-faint"
                >
                  Clear filters
                </Link>
              )
            }
          />
        ) : (
          <>
            {/* Phones: one card per ticket */}
            <ul className="divide-y divide-line md:hidden">
              {data.items.map((t) => (
                <li key={t.id} className="relative px-4 py-3 hover:bg-paper/60">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <TicketStatusBadge status={t.status} />
                    {t.priority === 'HIGH' && <UrgentBadge />}
                    <span className="ml-auto text-xs text-ink-soft">{relative(t.lastMessageAt)}</span>
                  </div>
                  <Link href={`/admin/tickets/${t.id}`} className="mt-1 block font-semibold text-ink after:absolute after:inset-0 hover:text-padma">
                    {t.subject}
                  </Link>
                  <p className="line-clamp-2 text-sm text-ink-soft break-words">{t.preview}</p>
                  <p className="mt-1 text-xs text-ink-soft">
                    {t.ticketNo} · {t.customer.name} · {t.categoryLabel}
                    {t.order && <> · {t.order.orderNo}</>}
                  </p>
                  <p className="mt-0.5 text-xs">
                    <LastWord t={t} now={now} /> <span className="text-ink-faint">·</span>{' '}
                    <span className={t.assignee ? 'text-ink' : 'text-ink-faint'}>{t.assignee?.name ?? 'Unassigned'}</span>
                  </p>
                </li>
              ))}
            </ul>

            {/* Larger screens: a table */}
            <TableWrap className="hidden md:block">
              <Table>
                <thead>
                  <tr>
                    <Th>Ticket</Th>
                    <Th>Customer</Th>
                    <Th>Order</Th>
                    <Th>Priority</Th>
                    <Th>Assigned</Th>
                    <Th>Last message</Th>
                    {status === 'all' && <Th>Status</Th>}
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((t) => (
                    <tr key={t.id} className="relative hover:bg-paper/70">
                      <Td className="min-w-64 max-w-[26rem]">
                        <span className="block text-xs text-ink-soft">
                          <span className="tabular-nums">{t.ticketNo}</span> · {t.categoryLabel}
                        </span>
                        {/* The link's ::after stretches over the row so the whole row opens the ticket. */}
                        <Link href={`/admin/tickets/${t.id}`} className="font-semibold text-ink after:absolute after:inset-0 hover:text-padma hover:underline">
                          {t.subject}
                        </Link>
                        <span className="line-clamp-1 text-xs text-ink-soft break-words">{t.preview}</span>
                      </Td>
                      <Td className="whitespace-nowrap">
                        <span className="block text-ink">{t.customer.name}</span>
                        <span className="block text-xs text-ink-soft tabular-nums">{t.customer.phone}</span>
                      </Td>
                      <Td className="whitespace-nowrap">
                        {t.order ? (
                          <Link href={`/admin/orders/${t.order.id}`} className="relative z-10 font-medium text-padma hover:underline">
                            {t.order.orderNo}
                          </Link>
                        ) : (
                          <span className="text-ink-faint">None</span>
                        )}
                      </Td>
                      <Td>{t.priority === 'HIGH' ? <UrgentBadge /> : <span className="text-ink-faint">Normal</span>}</Td>
                      <Td className="whitespace-nowrap">{t.assignee ? t.assignee.name : <span className="text-ink-faint">Unassigned</span>}</Td>
                      <Td className="whitespace-nowrap">
                        <span className="block text-ink">{relative(t.lastMessageAt)}</span>
                        <span className="block text-xs">
                          <LastWord t={t} now={now} />
                        </span>
                      </Td>
                      {status === 'all' && (
                        <Td className="whitespace-nowrap">
                          <TicketStatusBadge status={t.status} />
                        </Td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          </>
        )}
      </Panel>
      <div className="mt-4">
        <UrlPagination page={data.page} pages={data.pages} />
      </div>
    </>
  );
}

/** Who spoke last, and for tickets that need a reply, how long the customer has waited. */
function LastWord({ t, now }: { t: TicketListItem; now: number }) {
  if (t.status === 'OPEN' && !t.lastFromStaff) {
    const late = now - new Date(t.lastMessageAt).getTime() > DAY;
    return (
      <span className="text-ink-soft">
        Customer wrote last ·{' '}
        <span className={clsx(late ? 'rounded bg-sindoor-tint px-1 font-semibold text-sindoor' : 'font-medium text-marigold-dark')}>waiting {waitFor(t.lastMessageAt, now)}</span>
      </span>
    );
  }
  return t.lastFromStaff ? <span className="text-ink-soft">We replied last</span> : <span className="text-ink-soft">Customer wrote last</span>;
}
