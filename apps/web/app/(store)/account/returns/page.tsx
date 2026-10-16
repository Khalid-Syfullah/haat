import { Undo2 } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Badge, EmptyState } from '@/components/ui';
import { date, RETURN_STATUS_LABEL, tk } from '@/lib/format';
import { serverApi } from '@/lib/server';

export const metadata: Metadata = { title: 'Returns' };

interface ReturnRow {
  id: string;
  orderNo: string;
  status: string;
  quantity: number;
  reason: string;
  details: string | null;
  refundAmount: number | null;
  refundMethod: string;
  adminNote: string | null;
  createdAt: string;
  item: { title: string; variantLabel: string | null; imageUrl: string | null; unitPrice: number };
}

const NEXT: Record<string, string> = {
  REQUESTED: 'We are reviewing your request, usually within 2 working days.',
  APPROVED: 'Approved. Hand the item to our courier or drop it at our hub.',
  RECEIVED: 'We received the item. Your refund is being processed.',
  REFUNDED: 'Refund complete.',
  REJECTED: 'This return was not accepted.',
};

export default async function ReturnsPage() {
  const rows = (await serverApi<ReturnRow[]>('/returns')) ?? [];
  return (
    <div className="space-y-3">
      <h1 className="text-xl font-bold">Returns and refunds</h1>
      {rows.length === 0 ? (
        <div className="rounded-[var(--radius-card)] border border-line bg-white">
          <EmptyState
            icon={<Undo2 className="size-10" />}
            title="No returns"
            body="Most items can be returned within 7 days of delivery. Start a return from the order page."
            action={
              <Link href="/account/orders?tab=to-review" className="font-semibold text-padma hover:underline">
                See delivered orders
              </Link>
            }
          />
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.id} className="rounded-[var(--radius-card)] border border-line bg-white p-4">
              <div className="flex gap-3">
                <span className="size-16 shrink-0 overflow-hidden rounded bg-paper">
                  {r.item.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.item.imageUrl} alt="" className="size-full object-cover" />
                  )}
                </span>
                <div className="min-w-0 flex-1 text-[15px]">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="line-clamp-1 font-medium">{r.item.title}</p>
                    <Badge tone={r.status === 'REFUNDED' ? 'green' : r.status === 'REJECTED' ? 'red' : 'amber'}>{RETURN_STATUS_LABEL[r.status]}</Badge>
                  </div>
                  <p className="text-sm text-ink-soft">
                    Qty {r.quantity}, {r.reason}. Requested {date(r.createdAt)} on{' '}
                    <Link href={`/account/orders/${r.orderNo}`} className="text-padma hover:underline">
                      order {r.orderNo}
                    </Link>
                  </p>
                  <p className="mt-1">{NEXT[r.status]}</p>
                  {r.status === 'REFUNDED' && r.refundAmount != null && (
                    <p className="text-sm text-padma">
                      {tk(r.refundAmount)} {r.refundMethod === 'COINS' ? 'added as coins' : 'refunded to your payment method'}
                    </p>
                  )}
                  {r.adminNote && <p className="mt-1 text-sm text-ink-soft">Note from Haat: {r.adminNote}</p>}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
