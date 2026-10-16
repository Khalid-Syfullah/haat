import { MessageCircleQuestion } from 'lucide-react';
import type { Metadata } from 'next';
import { flatParams, hrefWith, LinkTabs, Panel } from '@/components/admin/bits';
import { UrlPagination } from '@/components/admin/controls';
import { AdminQuestion, QuestionCard } from '@/components/admin/question-card';
import { AdminHeader } from '@/components/admin/shell';
import { EmptyState } from '@/components/ui';
import { mustGet } from '@/lib/server';

export const metadata: Metadata = { title: 'Questions' };

type List = { items: AdminQuestion[]; total: number; page: number; pages: number };

export default async function QuestionsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = flatParams(await searchParams);
  const unanswered = sp.unanswered === 'true';
  const [data, open] = await Promise.all([
    mustGet<List>(`/admin/questions?${new URLSearchParams(sp)}`),
    unanswered ? null : mustGet<List>('/admin/questions?unanswered=true'),
  ]);
  const openCount = unanswered ? data.total : (open?.total ?? 0);
  const tabs = [
    { key: 'open', label: 'Unanswered', count: openCount, href: hrefWith('/admin/questions', {}, { unanswered: 'true' }) },
    { key: 'all', label: 'All questions', href: '/admin/questions' },
  ];

  return (
    <>
      <AdminHeader title="Questions" description="Answer product questions from shoppers. Good answers help the next buyer decide." />
      <LinkTabs tabs={tabs} active={unanswered ? 'open' : 'all'} label="Question filter" />
      {data.items.length === 0 ? (
        <Panel>
          <EmptyState
            icon={<MessageCircleQuestion className="size-10" />}
            title={unanswered ? 'Every question is answered' : 'No questions yet'}
            body={unanswered ? 'New questions from product pages will show up here.' : 'Shoppers can ask about a product on its page. Their questions land here.'}
          />
        </Panel>
      ) : (
        <div className="space-y-3">
          {data.items.map((q) => (
            <QuestionCard key={`${q.id}:${q.answer ?? ''}:${q.isPublished}`} q={q} />
          ))}
        </div>
      )}
      <div className="mt-4">
        <UrlPagination page={data.page} pages={data.pages} />
      </div>
    </>
  );
}
