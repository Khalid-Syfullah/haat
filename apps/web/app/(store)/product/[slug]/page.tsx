import type { Metadata } from 'next';
import Link from 'next/link';
import { ProductCard } from '@/components/store/product-card';
import { ProductQuestions, ProductReviews } from '@/components/store/product-reviews';
import { ProductDetail, ProductView } from '@/components/store/product-view';
import { mustGet, serverApi } from '@/lib/server';
import type { Locations, ProductCardData } from '@/lib/types';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const p = await serverApi<ProductDetail>(`/products/${slug}`);
  if (!p) return { title: 'Product not found' };
  return {
    title: p.title,
    description: p.highlights.join('. ') || p.description.slice(0, 160),
    openGraph: { images: p.images[0]?.url ? [p.images[0].url] : [] },
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const [product, locations, related, reviews, questions] = await Promise.all([
    mustGet<ProductDetail>(`/products/${slug}`),
    serverApi<Locations>('/locations'),
    serverApi<ProductCardData[]>(`/products/${slug}/related`),
    serverApi(`/products/${slug}/reviews`),
    serverApi(`/products/${slug}/questions`),
  ]);

  return (
    <div className="mx-auto max-w-[1240px] space-y-4 px-3 py-4 sm:px-4">
      <nav className="flex flex-wrap gap-1 text-sm text-ink-soft" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-padma">
          Home
        </Link>
        {product.breadcrumb.map((b) => (
          <span key={b.slug}>
            <span className="px-1 text-ink-faint">/</span>
            <Link href={`/category/${b.slug}`} className="hover:text-padma">
              {b.name}
            </Link>
          </span>
        ))}
      </nav>

      <ProductView product={product} locations={locations} />

      <section className="rounded-[var(--radius-card)] border border-line bg-white p-4 sm:p-5" aria-labelledby="about-title">
        <h2 id="about-title" className="mb-3 text-lg font-semibold">
          About this product
        </h2>
        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
          <div className="max-w-[70ch] space-y-3 text-[15px] leading-relaxed text-ink">
            {product.description.split(/\n{2,}/).map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </div>
          {product.specs.length > 0 && (
            <div>
              <h3 className="mb-2 font-semibold">Specifications</h3>
              <dl className="divide-y divide-line overflow-hidden rounded-md border border-line text-sm">
                {product.specs.map((s) => (
                  <div key={s.name} className="grid grid-cols-[130px_1fr]">
                    <dt className="bg-paper px-3 py-2 text-ink-soft">{s.name}</dt>
                    <dd className="px-3 py-2">{s.value}</dd>
                  </div>
                ))}
                {product.warranty && (
                  <div className="grid grid-cols-[130px_1fr]">
                    <dt className="bg-paper px-3 py-2 text-ink-soft">Warranty</dt>
                    <dd className="px-3 py-2">{product.warranty}</dd>
                  </div>
                )}
              </dl>
            </div>
          )}
        </div>
      </section>

      {reviews && <ProductReviews slug={slug} initial={reviews} />}
      {questions && <ProductQuestions slug={slug} initial={questions} />}

      {related && related.length > 0 && (
        <section aria-labelledby="related-title">
          <h2 id="related-title" className="mb-3 text-lg font-semibold">
            You may also like
          </h2>
          <div className="no-scrollbar -mx-3 flex gap-2 overflow-x-auto px-3 sm:mx-0 sm:grid sm:grid-cols-4 sm:gap-3 sm:px-0 lg:grid-cols-6">
            {related.slice(0, 12).map((p) => (
              <ProductCard key={p.id} p={p} className="w-[44%] shrink-0 sm:w-auto" />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
