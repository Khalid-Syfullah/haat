import { MessageSquare } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { PendingReview, WriteReviewButton } from '@/components/store/account-widgets';
import { EmptyState, Stars } from '@/components/ui';
import { date } from '@/lib/format';
import { serverApi } from '@/lib/server';

export const metadata: Metadata = { title: 'My reviews' };

interface Mine {
  reviewReward: number;
  pending: PendingReview[];
  written: { id: string; rating: number; comment: string; images: string[]; reply: string | null; status: string; createdAt: string; product: { title: string; slug: string }; imageUrl: string | null; variantLabel: string | null }[];
}

export default async function ReviewsPage() {
  const data = await serverApi<Mine>('/reviews/mine');
  if (!data) return null;
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Reviews</h1>
      <section className="rounded-[var(--radius-card)] border border-line bg-white" aria-labelledby="todo-h">
        <h2 id="todo-h" className="border-b border-line px-4 py-3 font-semibold">
          Waiting for your review ({data.pending.length})
          {data.pending.length > 0 && <span className="ml-2 text-sm font-normal text-ink-soft">Earn {data.reviewReward} coins for each</span>}
        </h2>
        {data.pending.length === 0 ? (
          <p className="px-4 py-6 text-ink-soft">You've reviewed everything you received. Thank you!</p>
        ) : (
          <ul className="divide-y divide-line">
            {data.pending.map((i) => (
              <li key={i.orderItemId} className="flex items-center gap-3 px-4 py-3">
                <span className="size-14 shrink-0 overflow-hidden rounded bg-paper">
                  {i.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={i.imageUrl} alt="" className="size-full object-cover" />
                  )}
                </span>
                <div className="min-w-0 flex-1 text-[15px]">
                  <p className="line-clamp-1">{i.title}</p>
                  <p className="text-sm text-ink-soft">
                    {i.variantLabel ? `${i.variantLabel}, ` : ''}delivered {date(i.deliveredAt)}
                  </p>
                </div>
                <WriteReviewButton item={i} reward={data.reviewReward} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-[var(--radius-card)] border border-line bg-white" aria-labelledby="done-h">
        <h2 id="done-h" className="border-b border-line px-4 py-3 font-semibold">
          Your reviews
        </h2>
        {data.written.length === 0 ? (
          <EmptyState icon={<MessageSquare className="size-10" />} title="No reviews yet" body="Reviews help other shoppers and earn you coins." />
        ) : (
          <ul className="divide-y divide-line">
            {data.written.map((r) => (
              <li key={r.id} className="flex gap-3 px-4 py-3">
                <span className="size-14 shrink-0 overflow-hidden rounded bg-paper">
                  {r.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.imageUrl} alt="" className="size-full object-cover" />
                  )}
                </span>
                <div className="min-w-0 flex-1 text-[15px]">
                  <Link href={`/product/${r.product.slug}#reviews`} className="line-clamp-1 hover:text-padma">
                    {r.product.title}
                  </Link>
                  <div className="flex items-center gap-2">
                    <Stars value={r.rating} size={13} />
                    <span className="text-xs text-ink-faint">{date(r.createdAt)}</span>
                    {r.status === 'HIDDEN' && <span className="text-xs text-sindoor">Hidden by the store</span>}
                  </div>
                  {r.comment && <p className="mt-1">{r.comment}</p>}
                  {r.reply && (
                    <p className="mt-1 rounded bg-paper px-2 py-1 text-sm">
                      <span className="font-semibold text-padma">Haat replied: </span>
                      {r.reply}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
