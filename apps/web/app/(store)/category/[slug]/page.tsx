import type { Metadata } from 'next';
import Link from 'next/link';
import { Listing } from '@/components/store/listing';
import { mustGet, serverApi } from '@/lib/server';

interface CategoryInfo {
  category: { name: string; nameBn: string | null; slug: string };
  breadcrumb: { name: string; slug: string }[];
  children: { name: string; slug: string }[];
}

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const info = await serverApi<CategoryInfo>(`/categories/${slug}`);
  return { title: info?.category.name ?? 'Category' };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const info = await mustGet<CategoryInfo>(`/categories/${slug}`);
  return (
    <Listing
      params={sp}
      category={slug}
      subcategories={info.children}
      heading={
        <>
          <nav className="mb-1 flex flex-wrap gap-1 text-sm text-ink-soft" aria-label="Breadcrumb">
            <Link href="/" className="hover:text-padma">
              Home
            </Link>
            {info.breadcrumb.slice(0, -1).map((b) => (
              <span key={b.slug}>
                <span className="px-1 text-ink-faint">/</span>
                <Link href={`/category/${b.slug}`} className="hover:text-padma">
                  {b.name}
                </Link>
              </span>
            ))}
          </nav>
          <h1 className="text-2xl font-bold">
            {info.category.name}
            {info.category.nameBn && <span className="ml-2 text-lg font-medium text-ink-faint">{info.category.nameBn}</span>}
          </h1>
        </>
      }
    />
  );
}
