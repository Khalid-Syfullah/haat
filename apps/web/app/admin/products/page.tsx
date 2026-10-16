import { FileSpreadsheet, Package, Plus } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { AdminHeader } from '@/components/admin/shell';
import { FilterBar, UrlPagination } from '@/components/admin/catalog/common';
import { ArchiveProductButton } from '@/components/admin/catalog/product-actions';
import { CategoryRow, flattenCategories, indent, Panel, td, tdNum, th, thNum, Thumb } from '@/components/admin/catalog/utils';
import { Badge, EmptyState } from '@/components/ui';
import { tk } from '@/lib/format';
import { serverApi } from '@/lib/server';

export const metadata: Metadata = { title: 'Products' };

interface ProductRow {
  id: string;
  title: string;
  slug: string;
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  image: string | null;
  category: string;
  brand: string | null;
  variants: number;
  stock: number;
  minPrice: number;
  lowStock: boolean;
  soldCount: number;
}

const STATUS_TONE = { ACTIVE: 'green', DRAFT: 'neutral', ARCHIVED: 'red' } as const;
const STATUS_LABEL = { ACTIVE: 'Active', DRAFT: 'Draft', ARCHIVED: 'Archived' } as const;

export default async function ProductsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const values = { q: sp.q ?? '', status: sp.status ?? '', categoryId: sp.categoryId ?? '', lowStock: sp.lowStock ?? '' };
  const qs = new URLSearchParams({ limit: '20', page: sp.page ?? '1' });
  if (values.q) qs.set('q', values.q);
  if (values.status) qs.set('status', values.status);
  if (values.categoryId) qs.set('categoryId', values.categoryId);
  if (values.lowStock) qs.set('lowStock', 'true');

  const [data, categories] = await Promise.all([
    serverApi<{ items: ProductRow[]; total: number; page: number; pages: number }>(`/admin/products?${qs}`),
    serverApi<CategoryRow[]>('/admin/categories'),
  ]);
  const items = data?.items ?? [];
  const filtered = Boolean(values.q || values.status || values.categoryId || values.lowStock);

  return (
    <>
      <AdminHeader
        title="Products"
        description={data ? `${data.total} product${data.total === 1 ? '' : 's'}` : undefined}
        actions={
          <>
            <Link
              href="/admin/products/import"
              className="inline-flex h-10 items-center gap-2 rounded-md border border-line bg-white px-4 text-[15px] font-semibold text-ink hover:border-ink-faint"
            >
              <FileSpreadsheet className="size-4" aria-hidden />
              Import &amp; export
            </Link>
            <Link
              href="/admin/products/new"
              className="inline-flex h-10 items-center gap-2 rounded-md bg-padma px-4 text-[15px] font-semibold text-white hover:bg-padma-dark"
            >
              <Plus className="size-4" aria-hidden />
              Add product
            </Link>
          </>
        }
      />
      <Panel>
        <FilterBar
          key={JSON.stringify(values)}
          basePath="/admin/products"
          values={values}
          fields={[
            { type: 'search', name: 'q', label: 'Search', placeholder: 'Title or SKU' },
            {
              type: 'select',
              name: 'status',
              label: 'Status',
              options: [
                { value: '', label: 'All statuses' },
                { value: 'ACTIVE', label: 'Active' },
                { value: 'DRAFT', label: 'Draft' },
                { value: 'ARCHIVED', label: 'Archived' },
              ],
            },
            {
              type: 'select',
              name: 'categoryId',
              label: 'Category',
              options: [
                { value: '', label: 'All categories' },
                ...flattenCategories(categories ?? []).map((c) => ({ value: c.id, label: indent(c.depth) + c.name })),
              ],
            },
            { type: 'toggle', name: 'lowStock', label: 'Low stock' },
          ]}
        />
        {items.length === 0 ? (
          <EmptyState
            icon={<Package className="size-8" />}
            title={filtered ? 'No products match these filters' : 'No products yet'}
            body={filtered ? 'Clear the search or pick another status or category.' : 'Add your first product to start selling.'}
          />
        ) : (
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr>
                  <th className={th}>
                    <span className="sr-only">Image</span>
                  </th>
                  <th className={th}>Product</th>
                  <th className={th}>Category</th>
                  <th className={th}>Brand</th>
                  <th className={thNum}>Variants</th>
                  <th className={thNum}>Stock</th>
                  <th className={thNum}>Price from</th>
                  <th className={thNum}>Sold</th>
                  <th className={th}>Status</th>
                  <th className={th}>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((p) => (
                  <tr key={p.id} className="hover:bg-paper/50">
                    <td className={td}>
                      <Thumb src={p.image} />
                    </td>
                    <td className={td}>
                      <Link href={`/admin/products/${p.id}`} className="font-medium text-ink hover:text-padma hover:underline">
                        {p.title}
                      </Link>
                    </td>
                    <td className={`${td} text-ink-soft`}>{p.category}</td>
                    <td className={`${td} text-ink-soft`}>{p.brand ?? 'No brand'}</td>
                    <td className={tdNum}>{p.variants}</td>
                    <td className={tdNum}>{p.lowStock ? <Badge tone="amber">{p.stock} low</Badge> : p.stock}</td>
                    <td className={tdNum}>{tk(p.minPrice)}</td>
                    <td className={tdNum}>{p.soldCount}</td>
                    <td className={td}>
                      <Badge tone={STATUS_TONE[p.status]}>{STATUS_LABEL[p.status]}</Badge>
                    </td>
                    <td className={`${td} text-right`}>
                      {p.status !== 'ARCHIVED' && <ArchiveProductButton id={p.id} title={p.title} />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && <UrlPagination basePath="/admin/products" values={values} page={data.page} pages={data.pages} />}
      </Panel>
    </>
  );
}
