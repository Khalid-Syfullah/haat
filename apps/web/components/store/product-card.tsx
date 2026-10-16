import clsx from 'clsx';
import { Zap } from 'lucide-react';
import Link from 'next/link';
import { compactCount, tk } from '@/lib/format';
import type { ProductCardData } from '@/lib/types';
import { Stars } from '../ui';

export function ProductCard({ p, className }: { p: ProductCardData; className?: string }) {
  return (
    <Link
      href={`/product/${p.slug}`}
      className={clsx(
        'group flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-line bg-white transition-colors hover:border-padma/40',
        className,
      )}
    >
      <div className="relative aspect-square bg-paper">
        {p.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.image} alt={p.title} loading="lazy" className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
        )}
        {p.flash && (
          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded bg-marigold px-1.5 py-0.5 text-xs font-bold text-ink">
            <Zap className="size-3 fill-ink" /> Flash
          </span>
        )}
        {!p.inStock && (
          <span className="absolute inset-x-0 bottom-0 bg-ink/75 py-1 text-center text-sm font-semibold text-white">Out of stock</span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-2.5">
        <p className="line-clamp-2 min-h-[2.6em] text-[14px] leading-[1.3] text-ink">{p.title}</p>
        <p className="mt-auto text-[17px] font-bold leading-tight text-sindoor">{tk(p.price)}</p>
        <p className="flex h-4 items-center gap-1.5 text-xs text-ink-faint">
          {p.discountPct > 0 && (
            <>
              <span className="line-through">{tk(p.originalPrice)}</span>
              <span className="font-semibold text-ink-soft">-{p.discountPct}%</span>
            </>
          )}
        </p>
        <p className="flex items-center gap-1 text-xs text-ink-soft">
          {p.ratingCount > 0 ? (
            <>
              <Stars value={p.ratingAvg} size={11} />
              <span>({p.ratingCount})</span>
            </>
          ) : (
            <span>New</span>
          )}
          {p.soldCount > 0 && <span className="ml-auto">{compactCount(p.soldCount)} sold</span>}
        </p>
      </div>
    </Link>
  );
}

export function ProductGrid({ items, className }: { items: ProductCardData[]; className?: string }) {
  return (
    <div className={clsx('grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 md:grid-cols-4 lg:grid-cols-6', className)}>
      {items.map((p) => (
        <ProductCard key={p.id} p={p} />
      ))}
    </div>
  );
}
