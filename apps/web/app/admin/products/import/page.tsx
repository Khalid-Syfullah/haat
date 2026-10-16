import { ArrowLeft, Download, FileSpreadsheet } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Panel } from '@/components/admin/bits';
import { CatalogImport } from '@/components/admin/catalog-import';
import { AdminHeader } from '@/components/admin/shell';
import { getMe } from '@/lib/server';

export const metadata: Metadata = { title: 'Import & export' };

const TIPS: { title: string; body: string }[] = [
  { title: 'One row per SKU', body: 'Each row is one variant. Rows with the same product handle belong to the same product.' },
  { title: 'Empty cells change nothing', body: 'Leave a cell empty to keep what the store has now. Product details can go on the first row of each product only.' },
  { title: 'Removing a sale price', body: 'Write "none" in the Sale price column to end a sale. A sale price must be below the price.' },
  { title: 'New SKUs and products', body: 'A SKU the store does not have yet is added as a new variant. New products need a handle, title, category and price.' },
];

export default async function CatalogImportPage() {
  // The page itself reads nothing, so check the permission here (the API checks it again on every call).
  const me = await getMe();
  if (me.user && !me.user.permissions.includes('CATALOG')) redirect('/admin/no-access');

  return (
    <>
      <Link href="/admin/products" className="mb-2 inline-flex items-center gap-1 text-sm text-ink-soft hover:text-ink">
        <ArrowLeft className="size-4" /> Products
      </Link>
      <AdminHeader title="Import & export" description="Change prices, stock and product details for many SKUs at once with an Excel file." />

      <div className="space-y-4">
        <Panel title="1. Start from your catalog" description="Download the full catalog to edit what you sell now, or a blank template to add new products." bodyClassName="p-4">
          <div className="flex flex-wrap gap-2">
            <a
              href="/api/admin/catalog/export"
              download
              className="inline-flex h-10 items-center gap-2 rounded-md bg-padma px-4 text-[15px] font-semibold text-white hover:bg-padma-dark"
            >
              <Download className="size-4" aria-hidden />
              Download full catalog
            </a>
            <a
              href="/api/admin/catalog/template"
              download
              className="inline-flex h-10 items-center gap-2 rounded-md border border-line bg-white px-4 text-[15px] font-semibold text-ink hover:border-ink-faint"
            >
              <FileSpreadsheet className="size-4" aria-hidden />
              Download blank template
            </a>
          </div>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {TIPS.map((t) => (
              <li key={t.title} className="rounded-md bg-paper px-3 py-2.5 text-sm">
                <p className="font-semibold text-ink">{t.title}</p>
                <p className="text-ink-soft">{t.body}</p>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-ink-soft">Both files have a &quot;How to fill&quot; sheet that explains every column. Keep the header row as it is.</p>
        </Panel>

        <CatalogImport />
      </div>
    </>
  );
}
