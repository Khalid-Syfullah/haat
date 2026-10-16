import { MessageSquare } from 'lucide-react';
import type { Metadata } from 'next';
import { flatParams, Panel } from '@/components/admin/bits';
import { FilterSelect, FilterToggle, Toolbar, UrlPagination } from '@/components/admin/controls';
import { AdminReview, ReviewCard } from '@/components/admin/review-card';
import { AdminHeader } from '@/components/admin/shell';
import { EmptyState } from '@/components/ui';
import { mustGet } from '@/lib/server';

export const metadata: Metadata = { title: 'Reviews' };

export default async function ReviewsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = flatParams(await searchParams);
  const data = await mustGet<{ items: AdminReview[]; total: number; page: number; pages: number }>(`/admin/reviews?${new URLSearchParams(sp)}`);
  const filtered = Boolean(sp.rating || sp.status || sp.unreplied);

  return (
    <>
      <AdminHeader title="Reviews" description={`${data.total} review${data.total === 1 ? '' : 's'}${filtered ? ' match these filters' : ''}. Reply to build trust, hide anything abusive.`} />
      <Toolbar>
        <FilterSelect
          param="rating"
          label="Rating"
          allLabel="Any rating"
          options={[5, 4, 3, 2, 1].map((n) => ({ value: String(n), label: `${n} star${n === 1 ? '' : 's'}` }))}
        />
        <FilterSelect
          param="status"
          label="Visibility"
          allLabel="Published and hidden"
          options={[
            { value: 'PUBLISHED', label: 'Published' },
            { value: 'HIDDEN', label: 'Hidden' },
          ]}
        />
        <FilterToggle param="unreplied" label="No reply yet" />
      </Toolbar>

      {data.items.length === 0 ? (
        <Panel>
          <EmptyState
            icon={<MessageSquare className="size-10" />}
            title={filtered ? 'No reviews match' : 'No reviews yet'}
            body={filtered ? 'Try another rating or clear the filters.' : 'Customers can review items after delivery. Their reviews will show up here.'}
          />
        </Panel>
      ) : (
        <div className="space-y-3">
          {data.items.map((r) => (
            <ReviewCard key={`${r.id}:${r.status}:${r.reply ?? ''}`} r={r} />
          ))}
        </div>
      )}
      <div className="mt-4">
        <UrlPagination page={data.page} pages={data.pages} />
      </div>
    </>
  );
}
