import clsx from 'clsx';
import { ChevronRight, LifeBuoy, Phone, Plus } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { SupportStatusBadge, SupportTicketSummary } from '@/components/store/support-bits';
import { EmptyState } from '@/components/ui';
import { relative } from '@/lib/format';
import { serverApi } from '@/lib/server';

export const metadata: Metadata = { title: 'Help and support' };

export default async function SupportPage() {
  const [tickets, info] = await Promise.all([
    serverApi<SupportTicketSummary[]>('/support/tickets'),
    serverApi<{ store: { name: string; supportPhone: string } }>('/store'),
  ]);
  const rows = tickets ?? [];
  const replied = rows.filter((t) => t.status === 'PENDING').length;
  const phone = info?.store.supportPhone;
  const store = info?.store.name ?? 'Haat';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold">Help and support</h1>
          <p className="text-[15px] text-ink-soft">
            {replied > 0
              ? `We replied to ${replied === 1 ? 'one of your requests' : `${replied} of your requests`}. Open it to read our answer.`
              : 'Ask us about an order, a delivery, a payment or anything else. We answer here.'}
          </p>
        </div>
        <Link href="/account/support/new" className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-md bg-padma px-4 text-[15px] font-semibold text-white hover:bg-padma-dark">
          <Plus className="size-4" aria-hidden /> New request
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-[var(--radius-card)] border border-line bg-white">
          <EmptyState
            icon={<LifeBuoy className="size-10" />}
            title="No requests yet"
            body="If something is wrong with an order, or you have a question, send us a request. You can add photos, and we reply right here."
            action={
              <Link href="/account/support/new" className="inline-flex h-10 items-center rounded-md bg-padma px-4 text-[15px] font-semibold text-white hover:bg-padma-dark">
                New request
              </Link>
            }
          />
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map((t) => {
            const ours = t.status === 'PENDING';
            return (
              <li key={t.ticketNo}>
                <Link
                  href={`/account/support/${t.ticketNo}`}
                  className={clsx(
                    'flex items-center gap-3 rounded-[var(--radius-card)] border bg-white px-4 py-3 hover:border-ink-faint',
                    ours ? 'border-padma ring-1 ring-padma/30' : 'border-line',
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      {ours && <span className="size-2 shrink-0 rounded-full bg-padma" aria-hidden />}
                      <p className={clsx('min-w-0 text-[15px] break-words', ours ? 'font-bold' : 'font-semibold')}>{t.subject}</p>
                      <SupportStatusBadge status={t.status} />
                    </div>
                    <p className="text-sm text-ink-soft">
                      {t.ticketNo} · {t.categoryLabel}
                      {t.orderNo && <> · Order {t.orderNo}</>}
                    </p>
                    {t.last && (
                      <p className="mt-1 line-clamp-2 text-sm text-ink break-words">
                        <span className="font-semibold">{t.last.fromStaff ? `${store}: ` : 'You: '}</span>
                        {t.last.body}
                      </p>
                    )}
                    <p className="mt-0.5 text-xs text-ink-faint">{relative(t.lastMessageAt)}</p>
                  </div>
                  <ChevronRight className="size-5 shrink-0 text-ink-faint" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {phone && (
        <p className="flex items-center gap-2 rounded-[var(--radius-card)] bg-padma-tint px-4 py-3 text-[15px] text-padma-dark">
          <Phone className="size-4 shrink-0" aria-hidden />
          <span>
            Prefer to talk? Call us on{' '}
            <a href={`tel:${phone.replace(/[^\d+]/g, '')}`} className="font-semibold underline">
              {phone}
            </a>
          </span>
        </p>
      )}
    </div>
  );
}
