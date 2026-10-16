import { SearchX } from 'lucide-react';
import Link from 'next/link';
import { Suspense } from 'react';
import { serverApi } from '@/lib/server';
import type { ListResponse } from '@/lib/types';
import { EmptyState } from '../ui';
import { Filters, MobileFilters, SortSelect } from './listing-controls';
import { ProductGrid } from './product-card';

type Params = Record<string, string | string[] | undefined>;

export function toQuery(params: Params, extra: Record<string, string> = {}) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (typeof v === 'string' && v) q.set(k, v);
  for (const [k, v] of Object.entries(extra)) q.set(k, v);
  return q;
}

/** Shared search / category results page body. */
export async function Listing({
  params,
  category,
  heading,
  subheading,
  subcategories,
}: {
  params: Params;
  category?: string;
  heading: React.ReactNode;
  subheading?: React.ReactNode;
  subcategories?: { name: string; slug: string }[];
}) {
  const query = toQuery(params, { limit: '30', ...(category ? { category } : {}) });
  const data = await serverApi<ListResponse>(`/products?${query.toString()}`);
  if (!data) return null;
  const page = data.page;
  const pageHref = (p: number) => {
    const q = toQuery(params, { page: String(p) });
    return `?${q.toString()}`;
  };

  return (
    <div className="mx-auto flex max-w-[1240px] gap-6 px-3 py-4 sm:px-4 sm:py-6">
      <Suspense>
        <Filters facets={data.facets} subcategories={subcategories} />
      </Suspense>
      <div className="min-w-0 flex-1">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            {heading}
            <p className="mt-0.5 text-[15px] text-ink-soft">
              {data.total} {data.total === 1 ? 'item' : 'items'} found{subheading}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Suspense>
              <MobileFilters facets={data.facets} subcategories={subcategories} />
              <SortSelect />
            </Suspense>
          </div>
        </div>
        {data.items.length === 0 ? (
          <div className="rounded-[var(--radius-card)] border border-line bg-white">
            <EmptyState
              icon={<SearchX className="size-10" />}
              title="No products match"
              body="Try a different spelling, fewer words, or remove some filters. Bangla and Banglish words work too."
              action={
                <Link href="/search" className="font-semibold text-padma hover:underline">
                  Browse all products
                </Link>
              }
            />
          </div>
        ) : (
          <ProductGrid items={data.items} className="lg:grid-cols-5" />
        )}
        {data.pages > 1 && (
          <nav className="mt-8 flex flex-wrap items-center justify-center gap-1" aria-label="Pages">
            {page > 1 && (
              <Link href={pageHref(page - 1)} className="rounded-md border border-line bg-white px-3 py-1.5 text-sm font-semibold hover:border-ink-faint">
                Previous
              </Link>
            )}
            {Array.from({ length: data.pages }, (_, i) => i + 1)
              .filter((n) => n === 1 || n === data.pages || Math.abs(n - page) <= 2)
              .map((n) => (
                <Link
                  key={n}
                  href={pageHref(n)}
                  aria-current={n === page ? 'page' : undefined}
                  className={n === page ? 'rounded-md bg-padma px-3 py-1.5 text-sm font-semibold text-white' : 'rounded-md px-3 py-1.5 text-sm font-semibold hover:bg-black/5'}
                >
                  {n}
                </Link>
              ))}
            {page < data.pages && (
              <Link href={pageHref(page + 1)} className="rounded-md border border-line bg-white px-3 py-1.5 text-sm font-semibold hover:border-ink-faint">
                Next
              </Link>
            )}
          </nav>
        )}
      </div>
    </div>
  );
}
