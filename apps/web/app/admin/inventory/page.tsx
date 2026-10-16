import { Warehouse } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { AdminHeader } from '@/components/admin/shell';
import { FilterBar, UrlPagination } from '@/components/admin/catalog/common';
import { InventoryActions } from '@/components/admin/catalog/inventory-actions';
import { Panel, td, tdNum, th, thNum, Thumb } from '@/components/admin/catalog/utils';
import { Badge, EmptyState } from '@/components/ui';
import { serverApi } from '@/lib/server';

export const metadata: Metadata = { title: 'Inventory' };

interface InventoryRow {
  id: string;
  sku: string;
  label: string | null;
  stock: number;
  lowStockThreshold: number;
  low: boolean;
  price: number;
  product: { id: string; title: string; slug: string; image: string | null };
}

export default async function InventoryPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const values = { q: sp.q ?? '', lowOnly: sp.lowOnly ?? '' };
  const qs = new URLSearchParams({ page: sp.page ?? '1' });
  if (values.q) qs.set('q', values.q);
  if (values.lowOnly) qs.set('lowOnly', 'true');
  const data = await serverApi<{ items: InventoryRow[]; total: number; page: number; pages: number }>(`/admin/inventory?${qs}`);
  const items = data?.items ?? [];

  return (
    <>
      <AdminHeader
        title="Inventory"
        description={data ? `${data.total} variant${data.total === 1 ? '' : 's'}${values.lowOnly ? ' at or below their alert level' : ', lowest stock first'}` : undefined}
      />
      <Panel>
        <FilterBar
          key={JSON.stringify(values)}
          basePath="/admin/inventory"
          values={values}
          fields={[
            { type: 'search', name: 'q', label: 'Search', placeholder: 'Product title or SKU' },
            { type: 'toggle', name: 'lowOnly', label: 'Low stock only' },
          ]}
        />
        {items.length === 0 ? (
          <EmptyState
            icon={<Warehouse className="size-8" />}
            title={values.q || values.lowOnly ? 'Nothing matches' : 'No stock to manage yet'}
            body={values.lowOnly ? 'Every variant is above its low-stock alert level.' : values.q ? 'Try another title or SKU.' : 'Add products with variants to track stock here.'}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr>
                  <th className={th}>
                    <span className="sr-only">Image</span>
                  </th>
                  <th className={th}>Product</th>
                  <th className={th}>Variant</th>
                  <th className={th}>SKU</th>
                  <th className={thNum}>Stock</th>
                  <th className={thNum}>Alert at</th>
                  <th className={th}>
                    <span className="sr-only">Level</span>
                  </th>
                  <th className={th}>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((v) => (
                  <tr key={v.id} className="hover:bg-paper/50">
                    <td className={td}>
                      <Thumb src={v.product.image} />
                    </td>
                    <td className={td}>
                      <Link href={`/admin/products/${v.product.id}`} className="font-medium text-ink hover:text-padma hover:underline">
                        {v.product.title}
                      </Link>
                    </td>
                    <td className={`${td} text-ink-soft`}>{v.label ?? 'Default'}</td>
                    <td className={`${td} font-mono text-xs text-ink-soft`}>{v.sku}</td>
                    <td className={`${tdNum} font-semibold`}>{v.stock}</td>
                    <td className={`${tdNum} text-ink-soft`}>{v.lowStockThreshold}</td>
                    <td className={td}>{v.stock === 0 ? <Badge tone="red">Out of stock</Badge> : v.low ? <Badge tone="amber">Low</Badge> : null}</td>
                    <td className={`${td} text-right`}>
                      <InventoryActions variant={{ id: v.id, sku: v.sku, stock: v.stock, name: v.label ? `${v.product.title}, ${v.label}` : v.product.title }} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && <UrlPagination basePath="/admin/inventory" values={values} page={data.page} pages={data.pages} />}
      </Panel>
    </>
  );
}
