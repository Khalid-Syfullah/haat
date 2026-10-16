'use client';

import clsx from 'clsx';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { Banner } from '@/lib/types';

export function HeroCarousel({ banners }: { banners: Banner[] }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const n = banners.length;

  useEffect(() => {
    if (paused || n < 2) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;
    const t = setInterval(() => setI((x) => (x + 1) % n), 6000);
    return () => clearInterval(t);
  }, [paused, n]);

  if (!n) return null;
  return (
    <section
      className="group relative overflow-hidden rounded-[var(--radius-card)] bg-padma-deep lg:h-full"
      aria-roledescription="carousel"
      aria-label="Offers"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="flex h-full transition-transform duration-500 ease-out" style={{ transform: `translateX(-${i * 100}%)` }}>
        {banners.map((b, idx) => (
          <Link
            key={b.id}
            href={b.link}
            className="block h-full w-full shrink-0"
            aria-hidden={idx !== i}
            tabIndex={idx === i ? 0 : -1}
            aria-label={`${b.title}${b.subtitle ? `: ${b.subtitle}` : ''}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={b.imageUrl} alt="" className="aspect-[1600/560] w-full object-cover lg:aspect-auto lg:h-full" fetchPriority={idx === 0 ? 'high' : 'auto'} />
          </Link>
        ))}
      </div>
      {n > 1 && (
        <>
          <button
            onClick={() => setI((i - 1 + n) % n)}
            className="absolute left-3 top-1/2 hidden -translate-y-1/2 rounded-full bg-white/85 p-1.5 text-ink opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100 sm:block"
            aria-label="Previous offer"
          >
            <ChevronLeft className="size-5" />
          </button>
          <button
            onClick={() => setI((i + 1) % n)}
            className="absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-full bg-white/85 p-1.5 text-ink opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100 sm:block"
            aria-label="Next offer"
          >
            <ChevronRight className="size-5" />
          </button>
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
            {banners.map((b, idx) => (
              <button
                key={b.id}
                onClick={() => setI(idx)}
                className={clsx('h-1.5 rounded-full transition-all', idx === i ? 'w-6 bg-marigold' : 'w-1.5 bg-white/60')}
                aria-label={`Show offer ${idx + 1}`}
                aria-current={idx === i}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
