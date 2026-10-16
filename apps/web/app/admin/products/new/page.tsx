import type { Metadata } from 'next';
import { BrandOption, ProductEditor } from '@/components/admin/catalog/product-editor';
import { CategoryRow } from '@/components/admin/catalog/utils';
import { serverApi } from '@/lib/server';

export const metadata: Metadata = { title: 'New product' };

export default async function NewProductPage() {
  const [categories, brands] = await Promise.all([serverApi<CategoryRow[]>('/admin/categories'), serverApi<BrandOption[]>('/admin/brands')]);
  return <ProductEditor categories={categories ?? []} brands={brands ?? []} />;
}
