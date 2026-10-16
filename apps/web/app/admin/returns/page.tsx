import { Undo2 } from 'lucide-react';
import type { Metadata } from 'next';
import { flatParams, hrefWith, LinkTabs, Panel, RETURN_STATUSES } from '@/components/admin/bits';
import { UrlPagination } from '@/components/admin/controls';
import { AdminReturn, ReturnCard } from '@/components/admin/return-card';
import { AdminHeader } from '@/components/admin/shell';
import { EmptyState } from '@/components/ui';
import { RETURN_STATUS_LABEL } from '@/lib/format';
import { mustGet } from '@/lib/server';

export const metadata: Metadata = { title: 'Returns' };

interface ReturnList {
  items: AdminReturn[];
  total: number;
  page: number;
  pages: number;
  statusCounts: Record<string, number>;
}

const EMPTY: Record<string, { title: string; body: string }> = {
  all: { title: 'No returns yet', body: 'When a customer asks to return a delivered item, the request lands here for you to approve or reject.' },
  REQUESTED: { title: 'No new requests', body: 'You are all caught up. New return requests will appear here.' },
  APPROVED: { title: 'Nothing on its way back', body: 'Approved returns wait here until the item reaches the hub. Then mark it received.' },
  RECEIVED: { title: 'No refunds waiting', body: 'Items that came back show up here so you can send the refund.' },
  REFUNDED: { title: 'No refunded returns', body: 'Completed returns are listed here for your records.' },
  REJECTED: { title: 'No rejected returns', body: 'Returns you turn down are kept here.' },
};

export default async function ReturnsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = flatParams(await searchParams);
  const status = sp.status && sp.status in RETURN_STATUS_LABEL ? sp.status : 'all';
  const qs = new URLSearchParams({ ...(status !== 'all' ? { status } : {}), ...(sp.page ? { page: sp.page } : {}) });
  const data = await mustGet<ReturnList>(`/admin/returns?${qs}`);
  const all = Object.values(data.statusCounts).reduce((a, b) => a + b, 0);

  const tabs = [
    { key: 'all', label: 'All', count: all, href: '/admin/returns' },
    ...RETURN_STATUSES.map((s) => ({ key: s, label: RETURN_STATUS_LABEL[s], count: data.statusCounts[s] ?? 0, href: hrefWith('/admin/returns', {}, { status: s }) })),
  ];
  const empty = EMPTY[status] ?? EMPTY.all;

  return (
    <>
      <AdminHeader title="Returns" description="Approve requests, receive items back and send refunds." />
      <LinkTabs tabs={tabs} active={status} label="Return status" />
      {data.items.length === 0 ? (
        <Panel>
          <EmptyState icon={<Undo2 className="size-10" />} title={empty.title} body={empty.body} />
        </Panel>
      ) : (
        <div className="space-y-3">
          {data.items.map((r) => (
            <ReturnCard key={`${r.id}:${r.status}`} r={r} />
          ))}
        </div>
      )}
      <div className="mt-4">
        <UrlPagination page={data.page} pages={data.pages} />
      </div>
    </>
  );
}
