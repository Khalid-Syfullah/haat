import type { Metadata } from 'next';
import Link from 'next/link';
import { CategoryIcon } from '@/components/store/category-icon';
import { serverApi } from '@/lib/server';
import type { CategoryNode } from '@/lib/types';

export const metadata: Metadata = { title: 'All categories' };

export default async function CategoriesPage() {
  const tree = (await serverApi<CategoryNode[]>('/categories')) ?? [];
  return (
    <div className="mx-auto max-w-[1240px] px-3 py-5 sm:px-4">
      <h1 className="mb-4 text-2xl font-bold">All categories</h1>
      <div className="space-y-6">
        {tree.map((top) => (
          <section key={top.id} aria-labelledby={`cat-${top.slug}`}>
            <div className="mb-2 flex items-center gap-2">
              <CategoryIcon icon={top.icon} className="size-5 text-padma" />
              <h2 id={`cat-${top.slug}`} className="text-lg font-semibold">
                <Link href={`/category/${top.slug}`} className="hover:text-padma">
                  {top.name}
                </Link>
              </h2>
              {top.nameBn && <span className="text-ink-faint">{top.nameBn}</span>}
            </div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-8">
              {top.children.map((c) => (
                <Link key={c.id} href={`/category/${c.slug}`} className="flex flex-col items-center gap-1 rounded-[var(--radius-card)] border border-line bg-white p-2 text-center hover:border-padma/40">
                  {c.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.imageUrl} alt="" loading="lazy" className="aspect-square w-full rounded object-cover" />
                  )}
                  <span className="text-[13px] font-medium leading-tight">{c.name}</span>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
