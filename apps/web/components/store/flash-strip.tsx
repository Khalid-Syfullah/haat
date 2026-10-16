import clsx from 'clsx';
import { Zap } from 'lucide-react';
import Link from 'next/link';
import { tk } from '@/lib/format';
import type { FlashItem, FlashSaleData } from '@/lib/types';
import { Countdown } from './countdown';

export function FlashItemCard({ item, live }: { item: FlashItem; live: boolean }) {
  const pct = Math.min(100, Math.round((item.soldQty / item.quantityLimit) * 100));
  return (
    <Link href={`/product/${item.slug}`} className="group flex flex-col rounded-[var(--radius-card)] bg-white p-2 hover:ring-1 hover:ring-marigold">
      <div className="relative aspect-square overflow-hidden rounded bg-paper">
        {item.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.image} alt={item.title} loading="lazy" className="size-full object-cover" />
        )}
        <span className="absolute right-1.5 top-1.5 rounded bg-sindoor px-1.5 py-0.5 text-xs font-bold text-white">-{item.discountPct}%</span>
        {item.soldOut && <span className="absolute inset-x-0 bottom-0 bg-ink/75 py-1 text-center text-sm font-semibold text-white">Sold out</span>}
      </div>
      <p className="mt-2 line-clamp-1 text-[14px] text-ink">{item.title}</p>
      <p className="text-[17px] font-bold text-sindoor">{tk(item.flashPrice)}</p>
      <p className="text-xs text-ink-faint line-through">{tk(item.originalPrice)}</p>
      {live && (
        <div className="mt-1.5">
          <div className="h-1.5 overflow-hidden rounded-full bg-marigold-tint" aria-hidden>
            <div className="h-full rounded-full bg-marigold" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-1 text-xs text-ink-soft">{item.soldOut ? 'All gone' : `${item.quantityLimit - item.soldQty} left at this price`}</p>
        </div>
      )}
    </Link>
  );
}

/** The home page flash-sale panel, framed with the kantha stitch. */
export function FlashStrip({ sale }: { sale: FlashSaleData }) {
  return (
    <section className="stitch-box rounded-lg bg-marigold-tint/60 p-3 sm:p-4" aria-labelledby="flash-title">
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <h2 id="flash-title" className="flex items-center gap-1.5 text-xl font-bold text-ink">
          <Zap className="size-5 fill-marigold text-marigold-dark" />
          {sale.title}
        </h2>
        <span className="flex items-center gap-2 text-sm text-ink-soft">
          {sale.live ? 'Ends in' : 'Starts in'}
          <Countdown to={sale.live ? sale.endsAt : sale.startsAt} />
        </span>
        <Link href="/flash-sale" className="ml-auto text-[15px] font-semibold text-padma hover:underline">
          See all deals
        </Link>
      </div>
      <div className={clsx('no-scrollbar -mx-1 flex snap-x gap-2 overflow-x-auto px-1 sm:grid sm:grid-cols-4 sm:overflow-visible lg:grid-cols-6')}>
        {sale.items.slice(0, 6).map((item) => (
          <div key={item.productId + item.flashPrice} className="w-[42%] shrink-0 snap-start sm:w-auto">
            <FlashItemCard item={item} live={sale.live} />
          </div>
        ))}
      </div>
    </section>
  );
}
