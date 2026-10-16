'use client';

import clsx from 'clsx';
import { SlidersHorizontal } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { tk } from '@/lib/format';
import type { ListResponse } from '@/lib/types';
import { Button, Input, Modal, Select, Stars } from '../ui';

export const SORTS = [
  { value: 'relevance', label: 'Best match' },
  { value: 'popular', label: 'Best selling' },
  { value: 'newest', label: 'Newest' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'rating', label: 'Top rated' },
];

function useUpdateParams() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  return (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v === null || v === '') next.delete(k);
      else next.set(k, v);
    }
    next.delete('page');
    router.push(`${pathname}?${next.toString()}`, { scroll: false });
  };
}

export function SortSelect() {
  const params = useSearchParams();
  const update = useUpdateParams();
  return (
    <label className="flex items-center gap-2 text-[15px] text-ink-soft">
      <span className="hidden whitespace-nowrap sm:inline">Sort by</span>
      <Select value={params.get('sort') ?? 'relevance'} onChange={(e) => update({ sort: e.target.value })} className="h-9 w-auto min-w-44" aria-label="Sort by">
        {SORTS.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </Select>
    </label>
  );
}

interface FiltersProps {
  facets: ListResponse['facets'];
  subcategories?: { name: string; slug: string }[];
}

function FilterBody({ facets, subcategories, onDone }: FiltersProps & { onDone?: () => void }) {
  const params = useSearchParams();
  const update = useUpdateParams();
  const brands = (params.get('brand') ?? '').split(',').filter(Boolean);
  const [min, setMin] = useState(params.get('minPrice') ?? '');
  const [max, setMax] = useState(params.get('maxPrice') ?? '');
  const rating = params.get('rating');

  function toggleBrand(slug: string) {
    const next = brands.includes(slug) ? brands.filter((b) => b !== slug) : [...brands, slug];
    update({ brand: next.join(',') || null });
    onDone?.();
  }

  function applyPrice(e: FormEvent) {
    e.preventDefault();
    update({ minPrice: min || null, maxPrice: max || null });
    onDone?.();
  }

  const active = brands.length > 0 || !!params.get('minPrice') || !!params.get('maxPrice') || !!rating;

  return (
    <div className="space-y-6 text-[15px]">
      {subcategories && subcategories.length > 0 && (
        <section>
          <h3 className="mb-2 font-semibold">Category</h3>
          <ul className="space-y-1">
            {subcategories.map((c) => (
              <li key={c.slug}>
                <Link href={`/category/${c.slug}`} className="text-ink-soft hover:text-padma">
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {facets.brands.length > 0 && (
        <section>
          <h3 className="mb-2 font-semibold">Brand</h3>
          <ul className="space-y-1.5">
            {facets.brands.map((b) => (
              <li key={b.slug}>
                <label className="flex cursor-pointer items-center gap-2">
                  <input type="checkbox" className="size-4 accent-padma" checked={brands.includes(b.slug)} onChange={() => toggleBrand(b.slug)} />
                  <span>{b.name}</span>
                  <span className="ml-auto text-sm text-ink-faint">{b.count}</span>
                </label>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section>
        <h3 className="mb-2 font-semibold">Price</h3>
        <form onSubmit={applyPrice} className="flex items-center gap-2">
          <Input inputMode="numeric" placeholder={facets.priceRange.min ? String(facets.priceRange.min) : 'Min'} value={min} onChange={(e) => setMin(e.target.value.replace(/\D/g, ''))} aria-label="Minimum price" className="h-9" />
          <span className="text-ink-faint">to</span>
          <Input inputMode="numeric" placeholder={facets.priceRange.max ? String(facets.priceRange.max) : 'Max'} value={max} onChange={(e) => setMax(e.target.value.replace(/\D/g, ''))} aria-label="Maximum price" className="h-9" />
          <Button size="sm" type="submit" variant="secondary" className="h-9">
            Go
          </Button>
        </form>
        {facets.priceRange.max > 0 && (
          <p className="mt-1 text-xs text-ink-faint">
            From {tk(facets.priceRange.min)} to {tk(facets.priceRange.max)}
          </p>
        )}
      </section>
      <section>
        <h3 className="mb-2 font-semibold">Rating</h3>
        <ul className="space-y-1">
          {[4, 3, 2].map((r) => (
            <li key={r}>
              <button
                onClick={() => {
                  update({ rating: rating === String(r) ? null : String(r) });
                  onDone?.();
                }}
                className={clsx('flex items-center gap-2 rounded px-1 py-0.5', rating === String(r) && 'bg-marigold-tint font-semibold')}
                aria-pressed={rating === String(r)}
              >
                <Stars value={r} size={15} /> <span className="text-ink-soft">and up</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
      {active && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            update({ brand: null, minPrice: null, maxPrice: null, rating: null });
            setMin('');
            setMax('');
            onDone?.();
          }}
        >
          Clear filters
        </Button>
      )}
    </div>
  );
}

export function Filters(props: FiltersProps) {
  return (
    <aside className="hidden w-56 shrink-0 lg:block" aria-label="Filters">
      <FilterBody {...props} />
    </aside>
  );
}

export function MobileFilters(props: FiltersProps) {
  const [open, setOpen] = useState(false);
  return (
    <div className="lg:hidden">
      <Button variant="outline" size="sm" className="h-9" onClick={() => setOpen(true)}>
        <SlidersHorizontal className="size-4" /> Filters
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Filters">
        <FilterBody {...props} onDone={() => setOpen(false)} />
      </Modal>
    </div>
  );
}
