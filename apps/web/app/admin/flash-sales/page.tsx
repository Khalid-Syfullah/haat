import { Plus, Zap } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { AdminHeader } from '@/components/admin/shell';
import { FlashSaleRowActions } from '@/components/admin/catalog/flash-sale-editor';
import { FlashSaleRow } from '@/components/admin/catalog/flash-types';
import { Panel, phaseOf, PhaseBadge, td, tdNum, th, thNum, Thumb } from '@/components/admin/catalog/utils';
import { EmptyState } from '@/components/ui';
import { dateTime } from '@/lib/format';
import { serverApi } from '@/lib/server';

export const metadata: Metadata = { title: 'Flash sales' };

const RANK = { live: 0, scheduled: 1, off: 2, ended: 3 } as const;

export default async function FlashSalesPage() {
  const sales = (await serverApi<FlashSaleRow[]>('/admin/flash-sales')) ?? [];
  const now = Date.now();
  const rows = sales
    .map((s) => ({ ...s, phase: phaseOf(s.startsAt, s.endsAt, s.isActive, now) }))
    .sort((a, b) => RANK[a.phase] - RANK[b.phase] || new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());

  return (
    <>
      <AdminHeader
        title="Flash sales"
        description="Time-boxed deals with a price, stock cap and per-customer limit for each variant."
        actions={
          <Link
            href="/admin/flash-sales/new"
            className="inline-flex h-10 items-center gap-2 rounded-md bg-padma px-4 text-[15px] font-semibold text-white hover:bg-padma-dark"
          >
            <Plus className="size-4" aria-hidden />
            Add flash sale
          </Link>
        }
      />
      <Panel>
        {rows.length === 0 ? (
          <EmptyState icon={<Zap className="size-8" />} title="No flash sales yet" body="Create one, pick the variants and set their flash prices." />
        ) : (
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr>
                  <th className={th}>Flash sale</th>
                  <th className={th}>Status</th>
                  <th className={th}>Starts</th>
                  <th className={th}>Ends</th>
                  <th className={thNum}>Items</th>
                  <th className={thNum}>Sold of cap</th>
                  <th className={th}>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => {
                  const sold = s.items.reduce((n, i) => n + i.soldQty, 0);
                  const cap = s.items.reduce((n, i) => n + i.quantityLimit, 0);
                  const pct = cap ? Math.min(100, Math.round((sold / cap) * 100)) : 0;
                  return (
                    <tr key={s.id} className="hover:bg-paper/50">
                      <td className={td}>
                        <div className="flex items-center gap-3">
                          {s.items.length > 0 && (
                            <span className="flex -space-x-2">
                              {s.items.slice(0, 3).map((i) => (
                                <Thumb key={i.id} src={i.image} size={32} className="ring-2 ring-white" />
                              ))}
                            </span>
                          )}
                          <Link href={`/admin/flash-sales/${s.id}`} className="font-medium text-ink hover:text-padma hover:underline">
                            {s.title}
                          </Link>
                        </div>
                      </td>
                      <td className={td}>
                        <PhaseBadge phase={s.phase} />
                      </td>
                      <td className={`${td} whitespace-nowrap text-ink-soft`}>{dateTime(s.startsAt)}</td>
                      <td className={`${td} whitespace-nowrap text-ink-soft`}>{dateTime(s.endsAt)}</td>
                      <td className={tdNum}>{s.items.length}</td>
                      <td className={tdNum}>
                        <div className="ml-auto w-32">
                          <span>
                            {sold} <span className="text-ink-faint">/ {cap}</span>
                          </span>
                          <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-paper" aria-hidden>
                            <span className="block h-full rounded-full bg-marigold" style={{ width: `${pct}%` }} />
                          </span>
                        </div>
                      </td>
                      <td className={`${td} whitespace-nowrap text-right`}>
                        <FlashSaleRowActions sale={{ id: s.id, title: s.title, sold }} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}
