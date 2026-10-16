import type { Metadata } from 'next';
import { AdminHeader } from '@/components/admin/shell';
import { CategoryManager } from '@/components/admin/catalog/category-manager';
import { CategoryRow } from '@/components/admin/catalog/utils';
import { serverApi } from '@/lib/server';

export const metadata: Metadata = { title: 'Categories' };

export default async function CategoriesPage() {
  const categories = (await serverApi<CategoryRow[]>('/admin/categories')) ?? [];
  return (
    <>
      <AdminHeader title="Categories" description={`${categories.length} categories. Sub-categories sit under their parent in the store menu.`} />
      <CategoryManager categories={categories} />
    </>
  );
}
