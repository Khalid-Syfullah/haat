import clsx from 'clsx';
import { ArrowLeft, CircleCheck, Clock, MessageCircleReply } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { StatusBadge } from '@/components/store/order-bits';
import { SupportStatusBadge, SupportTicketDetail } from '@/components/store/support-bits';
import { SupportMessages, SupportReplyBox } from '@/components/store/support-thread';
import { date, dateTime, tk } from '@/lib/format';
import { mustGet } from '@/lib/server';

type Props = { params: Promise<{ ticketNo: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { ticketNo } = await params;
  return { title: `Request ${ticketNo}` };
}

const NOTICE = {
  OPEN: { icon: Clock, tone: 'bg-marigold-tint text-ink', text: "We have your message. We'll reply here and send you a notification." },
  PENDING: { icon: MessageCircleReply, tone: 'bg-padma-tint text-padma-dark', text: 'We replied. If that sorts it out, mark the request as resolved. If not, just reply.' },
  RESOLVED: { icon: CircleCheck, tone: 'bg-paper text-ink', text: 'This request is resolved. Reply to open it again.' },
} as const;

export default async function SupportTicketPage({ params }: Props) {
  const { ticketNo } = await params;
  const t = await mustGet<SupportTicketDetail>(`/support/tickets/${encodeURIComponent(ticketNo)}`);
  const notice = NOTICE[t.status] ?? NOTICE.OPEN;
  const Icon = notice.icon;

  return (
    <div className="space-y-3">
      <Link href="/account/support" className="inline-flex items-center gap-1 text-sm text-ink-soft hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> All requests
      </Link>

      <section className="rounded-[var(--radius-card)] border border-line bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h1 className="min-w-0 text-xl font-bold break-words">{t.subject}</h1>
          <SupportStatusBadge status={t.status} />
        </div>
        <p className="text-sm text-ink-soft">
          {t.ticketNo} · {t.categoryLabel} · opened {date(t.createdAt)}
          {t.status === 'RESOLVED' && t.resolvedAt && <> · resolved {dateTime(t.resolvedAt)}</>}
        </p>
        {t.order && (
          <Link
            href={`/account/orders/${t.order.orderNo}`}
            className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-line px-3 py-2 text-sm hover:border-ink-faint"
          >
            <span>
              <span className="font-semibold text-padma">Order {t.order.orderNo}</span>
              <span className="block text-ink-soft">
                {date(t.order.createdAt)} · {tk(t.order.total)}
              </span>
            </span>
            <StatusBadge status={t.order.status} />
          </Link>
        )}
      </section>

      <p className={clsx('flex items-start gap-2 rounded-[var(--radius-card)] px-4 py-3 text-[15px]', notice.tone)} role="status">
        <Icon className="mt-0.5 size-5 shrink-0" aria-hidden />
        {notice.text}
      </p>

      <section className="rounded-[var(--radius-card)] border border-line bg-paper/60 p-3 sm:p-5" aria-label="Conversation">
        <SupportMessages messages={t.messages} />
      </section>

      <section className="rounded-[var(--radius-card)] border border-line bg-white p-4 sm:p-5" aria-label="Reply">
        <SupportReplyBox ticketNo={t.ticketNo} status={t.status} />
      </section>
    </div>
  );
}
