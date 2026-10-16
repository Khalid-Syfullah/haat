import clsx from 'clsx';
import { ArrowLeft, Phone } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { OrderStatusBadge, Panel, paymentLabel, PaymentStatusBadge, Row } from '@/components/admin/bits';
import { AdminHeader } from '@/components/admin/shell';
import { TicketDetail, TicketStatusBadge, UrgentBadge, waitFor } from '@/components/admin/ticket-bits';
import { TicketComposer } from '@/components/admin/ticket-composer';
import { TicketControls } from '@/components/admin/ticket-controls';
import { TicketThread } from '@/components/admin/ticket-thread';
import { Badge } from '@/components/ui';
import { date, dateTime, tk } from '@/lib/format';
import { getMe, mustGet, serverApi } from '@/lib/server';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const t = await serverApi<TicketDetail>(`/admin/tickets/${encodeURIComponent(id)}`);
  return { title: t ? `Ticket ${t.ticketNo}` : 'Ticket' };
}

export default async function TicketPage({ params }: Props) {
  const { id } = await params;
  const [t, me] = await Promise.all([mustGet<TicketDetail>(`/admin/tickets/${encodeURIComponent(id)}`), getMe()]);
  const last = t.messages[t.messages.length - 1];
  const waiting = t.status === 'OPEN' && last && !last.fromStaff;
  const late = waiting && Date.now() - new Date(last.createdAt).getTime() > 24 * 60 * 60 * 1000;

  return (
    <>
      <Link href="/admin/tickets" className="mb-2 inline-flex items-center gap-1 text-sm text-ink-soft hover:text-ink">
        <ArrowLeft className="size-4" /> Support tickets
      </Link>
      <AdminHeader
        title={t.subject}
        description={`${t.ticketNo} · ${t.categoryLabel} · opened ${dateTime(t.createdAt)} by ${t.user.name}`}
        actions={
          <div className="flex items-center gap-2">
            {t.priority === 'HIGH' && <UrgentBadge />}
            <TicketStatusBadge status={t.status} />
          </div>
        }
      />

      {waiting && (
        <p
          className={clsx(
            'mb-4 rounded-[6px] border px-4 py-2.5 text-sm',
            late ? 'border-sindoor/30 bg-sindoor-tint text-sindoor' : 'border-marigold/40 bg-marigold-tint text-ink',
          )}
        >
          <span className="font-semibold">{t.user.name.split(/\s+/)[0]} has been waiting {waitFor(last.createdAt)} for a reply.</span>
          {late && ' That is over a day, so answer this one first.'}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:grid-rows-[auto_1fr]">
        <div className="min-w-0 lg:col-start-2 lg:row-start-1">
          <Panel title="Ticket" bodyClassName="p-4">
            <TicketControls
              id={t.id}
              status={t.status}
              priority={t.priority}
              assigneeId={t.assignee?.id ?? null}
              staff={t.staff}
              meId={me.user?.id ?? null}
            />
            {t.resolvedAt && t.status === 'RESOLVED' && <p className="mt-3 border-t border-line pt-3 text-xs text-ink-soft">Resolved {dateTime(t.resolvedAt)}</p>}
          </Panel>
        </div>

        <div className="min-w-0 space-y-4 lg:col-start-1 lg:row-span-2 lg:row-start-1">
          <Panel title="Conversation" description={`${t.messages.length} message${t.messages.length === 1 ? '' : 's'}`} bodyClassName="bg-[#fafbf9] p-4">
            <TicketThread messages={t.messages} customerName={t.user.name} />
          </Panel>
          <Panel title="Reply" bodyClassName="p-4">
            <TicketComposer id={t.id} customerName={t.user.name} status={t.status} />
          </Panel>
        </div>

        <div className="min-w-0 space-y-4 lg:col-start-2 lg:row-start-2">
          <Panel title="Customer" bodyClassName="p-4 text-sm">
            <p className="font-semibold text-ink">{t.user.name}</p>
            <a href={`tel:${t.user.phone}`} className="inline-flex items-center gap-1.5 font-medium text-padma tabular-nums hover:underline">
              <Phone className="size-3.5" aria-hidden /> {t.user.phone}
            </a>
            {t.user.email && <p className="text-ink-soft break-all">{t.user.email}</p>}
            <p className="mt-1 text-xs text-ink-soft">Customer since {date(t.user.createdAt)}</p>
            {t.user.codBlocked && (
              <p className="mt-2">
                <Badge tone="red">Cash on delivery blocked</Badge>
              </p>
            )}
            <Link href={`/admin/customers?q=${encodeURIComponent(t.user.phone)}`} className="mt-2 inline-block font-medium text-padma hover:underline">
              View customer
            </Link>
          </Panel>

          {t.order && (
            <Panel
              title="Linked order"
              actions={
                <Link href={`/admin/orders/${t.order.id}`} className="text-sm font-medium text-padma hover:underline">
                  Open order
                </Link>
              }
              bodyClassName="p-4 text-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Link href={`/admin/orders/${t.order.id}`} className="font-semibold text-ink hover:text-padma hover:underline">
                  {t.order.orderNo}
                </Link>
                <OrderStatusBadge status={t.order.status} />
              </div>
              <dl className="mt-2">
                <Row label="Placed">{date(t.order.createdAt)}</Row>
                <Row label="Total">{tk(t.order.total)}</Row>
                <Row label={paymentLabel(t.order.paymentMethod)}>
                  <PaymentStatusBadge status={t.order.paymentStatus} />
                </Row>
                {t.order.courier && <Row label="Courier">{t.order.courier}</Row>}
                {t.order.trackingNo && (
                  <Row label="Tracking">
                    <span className="font-mono text-xs">{t.order.trackingNo}</span>
                  </Row>
                )}
              </dl>
            </Panel>
          )}

          <Panel title="Recent orders" bodyClassName="divide-y divide-line">
            {t.recentOrders.length === 0 ? (
              <p className="px-4 py-3 text-sm text-ink-soft">No orders yet.</p>
            ) : (
              t.recentOrders.map((o) => (
                <Link
                  key={o.id}
                  href={`/admin/orders/${o.id}`}
                  className={clsx('flex items-center justify-between gap-2 px-4 py-2.5 text-sm hover:bg-paper/70', o.id === t.order?.id && 'bg-padma-tint/50')}
                >
                  <span className="min-w-0">
                    <span className="block font-medium text-ink">{o.orderNo}</span>
                    <span className="block text-xs text-ink-soft">
                      {date(o.createdAt)} · {tk(o.total)}
                    </span>
                  </span>
                  <OrderStatusBadge status={o.status} />
                </Link>
              ))
            )}
          </Panel>

          <Panel title="Other tickets" bodyClassName="divide-y divide-line">
            {t.otherTickets.length === 0 ? (
              <p className="px-4 py-3 text-sm text-ink-soft">This is their first ticket.</p>
            ) : (
              t.otherTickets.map((o) => (
                <Link key={o.id} href={`/admin/tickets/${o.id}`} className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm hover:bg-paper/70">
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-ink">{o.subject}</span>
                    <span className="block text-xs text-ink-soft">
                      {o.ticketNo} · {date(o.createdAt)}
                    </span>
                  </span>
                  <TicketStatusBadge status={o.status} />
                </Link>
              ))
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
