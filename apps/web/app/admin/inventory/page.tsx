import { Warehouse } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { AdminHeader } from '@/components/admin/shell';
import { FilterBar, UrlPagination } from '@/components/admin/catalog/common';
import { InventoryActions } from '@/components/admin/catalog/inventory-actions';
import { BulkSelection, RowBox, SelectAllBox } from '@/components/admin/catalog/inventory-bulk';
import { Panel, td, tdNum, th, thNum, Thumb } from '@/components/admin/catalog/utils';
import { Badge, EmptyState } from '@/components/ui';
import { tk } from '@/lib/format';
import { serverApi } from '@/lib/server';

export const metadata: Metadata = { title: 'Inventory' };

interface InventoryRow {
  id: string;
  sku: string;
  label: string | null;
  stock: number;
  lowStockThreshold: number;
  low: boolean;
  /** What the customer pays now: the sale price when there is one. */
  price: number;
  regularPrice: number;
  salePrice: number | null;
  isActive: boolean;
  product: { id: string; title: string; slug: string; image: string | null };
}

export default async function InventoryPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const values = { q: sp.q ?? '', lowOnly: sp.lowOnly ?? '', hidden: sp.hidden ?? '' };
  const qs = new URLSearchParams({ page: sp.page ?? '1' });
  if (values.q) qs.set('q', values.q);
  if (values.lowOnly) qs.set('lowOnly', 'true');
  if (values.hidden) qs.set('hidden', 'true');
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
            { type: 'toggle', name: 'hidden', label: 'Include hidden SKUs' },
          ]}
        />
        {items.length === 0 ? (
          <EmptyState
            icon={<Warehouse className="size-8" />}
            title={values.q || values.lowOnly ? 'Nothing matches' : 'No stock to manage yet'}
            body={values.lowOnly ? 'Every variant is above its low-stock alert level.' : values.q ? 'Try another title or SKU.' : 'Add products with variants to track stock here.'}
          />
        ) : (
          <BulkSelection key={`${values.q}|${values.lowOnly}|${values.hidden}|${data?.page ?? 1}`} ids={items.map((v) => v.id)}>
            <div className="relative overflow-x-auto">
              <table className="w-full min-w-[920px] text-sm">
                <thead>
                  <tr>
                    <th className={`${th} w-10 pr-0`}>
                      <SelectAllBox />
                    </th>
                    <th className={th}>
                      <span className="sr-only">Image</span>
                    </th>
                    <th className={th}>Product</th>
                    <th className={th}>Variant</th>
                    <th className={th}>SKU</th>
                    <th className={thNum}>Selling at</th>
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
                    <tr key={v.id} className="hover:bg-paper/50 has-[:checked]:bg-padma-tint/40">
                      <td className={`${td} w-10 pr-0`}>
                        <RowBox id={v.id} label={`${v.product.title}${v.label ? `, ${v.label}` : ''} (${v.sku})`} />
                      </td>
                      <td className={td}>
                        <Thumb src={v.product.image} />
                      </td>
                      <td className={`${td} min-w-52`}>
                        <Link href={`/admin/products/${v.product.id}`} className="font-medium text-ink hover:text-padma hover:underline">
                          {v.product.title}
                        </Link>
                      </td>
                      <td className={`${td} text-ink-soft`}>{v.label ?? 'Default'}</td>
                      <td className={`${td} font-mono text-xs whitespace-nowrap text-ink-soft`}>{v.sku}</td>
                      <td className={`${tdNum} whitespace-nowrap`}>
                        {tk(v.price)}
                        {v.salePrice != null && <span className="block text-xs text-ink-faint line-through">{tk(v.regularPrice)}</span>}
                      </td>
                      <td className={`${tdNum} font-semibold`}>{v.stock}</td>
                      <td className={`${tdNum} text-ink-soft`}>{v.lowStockThreshold}</td>
                      <td className={`${td} whitespace-nowrap`}>
                        {!v.isActive ? (
                          <Badge tone="neutral">Hidden from store</Badge>
                        ) : v.stock === 0 ? (
                          <Badge tone="red">Out of stock</Badge>
                        ) : v.low ? (
                          <Badge tone="amber">Low</Badge>
                        ) : null}
                      </td>
                      <td className={`${td} text-right`}>
                        <InventoryActions variant={{ id: v.id, sku: v.sku, stock: v.stock, name: v.label ? `${v.product.title}, ${v.label}` : v.product.title }} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </BulkSelection>
        )}
        {data && <UrlPagination basePath="/admin/inventory" values={values} page={data.page} pages={data.pages} />}
      </Panel>
    </>
  );
}
