import clsx from 'clsx';
import { Coins } from 'lucide-react';
import type { Metadata } from 'next';
import { CheckInButton } from '@/components/store/account-widgets';
import { dateTime } from '@/lib/format';
import { serverApi } from '@/lib/server';

export const metadata: Metadata = { title: 'Coins' };

interface CoinsData {
  balance: number;
  canCheckIn: boolean;
  rules: { checkInReward: number; orderRewardPercent: number; reviewReward: number; maxRedeemPercent: number };
  transactions: { id: string; amount: number; reason: string; note: string | null; createdAt: string }[];
}

const REASON: Record<string, string> = {
  CHECK_IN: 'Daily check-in',
  ORDER_REWARD: 'Order reward',
  REVIEW_REWARD: 'Review reward',
  REDEEM: 'Spent at checkout',
  REFUND: 'Returned to you',
  ADJUSTMENT: 'Bonus',
};

export default async function CoinsPage() {
  const data = await serverApi<CoinsData>('/coins');
  if (!data) return null;
  return (
    <div className="space-y-4">
      <section className="rounded-[var(--radius-card)] bg-padma p-5 text-white">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-3">
            <Coins className="size-10 text-marigold" />
            <div>
              <p className="text-sm text-white/75">Your coins</p>
              <p className="text-4xl font-bold leading-none">{data.balance}</p>
            </div>
          </div>
          <div className="ml-auto">
            <CheckInButton canCheckIn={data.canCheckIn} reward={data.rules.checkInReward} />
          </div>
        </div>
        <p className="mt-3 text-[15px] text-white/80">1 coin = ৳1 off. Coins can pay up to {data.rules.maxRedeemPercent}% of an order.</p>
      </section>

      <section className="grid gap-3 sm:grid-cols-3" aria-label="Ways to earn">
        {[
          { title: 'Check in daily', body: `${data.rules.checkInReward} coins every day you check in` },
          { title: 'Shop', body: `${data.rules.orderRewardPercent}% of every delivered order back as coins` },
          { title: 'Review', body: `${data.rules.reviewReward} coins for each product review` },
        ].map((w) => (
          <div key={w.title} className="rounded-[var(--radius-card)] border border-line bg-white p-4">
            <p className="font-semibold">{w.title}</p>
            <p className="text-sm text-ink-soft">{w.body}</p>
          </div>
        ))}
      </section>

      <section className="rounded-[var(--radius-card)] border border-line bg-white" aria-labelledby="hist">
        <h2 id="hist" className="border-b border-line px-4 py-3 font-semibold">
          History
        </h2>
        {data.transactions.length === 0 ? (
          <p className="px-4 py-6 text-ink-soft">No coin activity yet. Check in today to start.</p>
        ) : (
          <ul className="divide-y divide-line">
            {data.transactions.map((t) => (
              <li key={t.id} className="flex items-center gap-3 px-4 py-3 text-[15px]">
                <div className="min-w-0 flex-1">
                  <p>{REASON[t.reason] ?? t.reason}</p>
                  <p className="truncate text-sm text-ink-soft">
                    {t.note ? `${t.note}, ` : ''}
                    {dateTime(t.createdAt)}
                  </p>
                </div>
                <span className={clsx('font-bold tabular-nums', t.amount > 0 ? 'text-padma' : 'text-ink-soft')}>
                  {t.amount > 0 ? '+' : ''}
                  {t.amount}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
