import { Zap } from 'lucide-react';
import type { Metadata } from 'next';
import { Countdown } from '@/components/store/countdown';
import { FlashItemCard } from '@/components/store/flash-strip';
import { EmptyState } from '@/components/ui';
import { serverApi } from '@/lib/server';
import type { FlashSaleData } from '@/lib/types';

export const metadata: Metadata = { title: 'Flash sale' };

export default async function FlashSalePage() {
  const sale = await serverApi<FlashSaleData | null>('/flash-sale');
  return (
    <div className="mx-auto max-w-[1240px] px-3 py-5 sm:px-4">
      {!sale ? (
        <div className="rounded-[var(--radius-card)] border border-line bg-white">
          <EmptyState icon={<Zap className="size-10" />} title="No flash sale right now" body="Flash sales run during campaigns with limited stock at big discounts. Check back soon." />
        </div>
      ) : (
        <>
          <section className="stitch-box mb-5 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg bg-marigold-tint/60 px-5 py-4">
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <Zap className="size-6 fill-marigold text-marigold-dark" /> {sale.title}
            </h1>
            <p className="flex items-center gap-2 text-ink-soft">
              {sale.live ? 'Ends in' : 'Starts in'} <Countdown to={sale.live ? sale.endsAt : sale.startsAt} />
            </p>
            <p className="w-full text-[15px] text-ink-soft sm:ml-auto sm:w-auto">Limited stock at each price. Up to 2 per customer.</p>
          </section>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 md:grid-cols-4 lg:grid-cols-6">
            {sale.items.map((item) => (
              <FlashItemCard key={item.productId + item.flashPrice} item={item} live={sale.live} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
