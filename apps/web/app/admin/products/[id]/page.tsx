import type { Metadata } from 'next';
import { AdminProduct, BrandOption, ProductEditor } from '@/components/admin/catalog/product-editor';
import { CategoryRow } from '@/components/admin/catalog/utils';
import { mustGet, serverApi } from '@/lib/server';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const p = await serverApi<AdminProduct>(`/admin/products/${id}`);
  return { title: p ? `Edit ${p.title}` : 'Product' };
}

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [product, categories, brands] = await Promise.all([
    mustGet<AdminProduct>(`/admin/products/${id}`),
    serverApi<CategoryRow[]>('/admin/categories'),
    serverApi<BrandOption[]>('/admin/brands'),
  ]);
  return <ProductEditor key={product.id} product={product} categories={categories ?? []} brands={brands ?? []} />;
}
