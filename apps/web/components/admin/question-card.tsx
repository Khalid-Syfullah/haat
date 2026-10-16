'use client';

import { Eye, EyeOff, MessageCircleReply } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Badge, Button, Textarea } from '@/components/ui';
import { patch } from '@/lib/api';
import { dateTime } from '@/lib/format';
import { useAction } from './use-action';

export interface AdminQuestion {
  id: string;
  question: string;
  answer: string | null;
  answeredAt: string | null;
  isPublished: boolean;
  createdAt: string;
  user: { name: string };
  product: { title: string; slug: string };
}

export function QuestionCard({ q }: { q: AdminQuestion }) {
  const { run, busy } = useAction();
  const [editing, setEditing] = useState(!q.answer);
  const [answer, setAnswer] = useState(q.answer ?? '');
  const id = `answer-${q.id}`;

  return (
    <article className="rounded-[6px] border border-line bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <Link href={`/product/${q.product.slug}#questions`} target="_blank" className="text-sm font-medium text-padma hover:underline">
            {q.product.title}
          </Link>
          <p className="mt-0.5 text-[15px] font-semibold text-ink">{q.question}</p>
          <p className="text-xs text-ink-soft">
            Asked by {q.user.name}, {dateTime(q.createdAt)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!q.answer && <Badge tone="amber">Unanswered</Badge>}
          {q.isPublished ? <Badge tone="green">Published</Badge> : <Badge tone="neutral">Hidden from store</Badge>}
        </div>
      </div>

      {editing ? (
        <form
          className="mt-3 space-y-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!answer.trim()) return;
            const ok = await run('answer', () => patch(`/admin/questions/${q.id}`, { answer: answer.trim() }), q.answer ? 'Answer updated' : 'Answer posted');
            if (ok) setEditing(false);
          }}
        >
          <label htmlFor={id} className="block text-sm font-medium text-ink">
            Answer
          </label>
          <Textarea id={id} value={answer} onChange={(e) => setAnswer(e.target.value)} maxLength={1000} className="min-h-20" placeholder="Answer for everyone who views this product" />
          <div className="flex flex-wrap items-center justify-end gap-2">
            <span className="mr-auto text-xs text-ink-soft">The customer is notified. The answer shows on the product page.</span>
            {q.answer && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setAnswer(q.answer ?? '');
                  setEditing(false);
                }}
              >
                Discard
              </Button>
            )}
            <Button type="submit" size="sm" loading={busy === 'answer'} disabled={!answer.trim()}>
              {q.answer ? 'Save answer' : 'Post answer'}
            </Button>
          </div>
        </form>
      ) : (
        <div className="mt-3 rounded-md border-l-2 border-padma bg-padma-tint/50 px-3 py-2">
          <p className="text-xs font-semibold text-padma-dark">Store answer{q.answeredAt ? `, ${dateTime(q.answeredAt)}` : ''}</p>
          <p className="text-sm whitespace-pre-line text-ink">{q.answer}</p>
        </div>
      )}

      {!editing && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
            <MessageCircleReply className="size-4" /> Edit answer
          </Button>
          <PublishButton q={q} busy={busy === 'publish'} run={run} />
        </div>
      )}
      {editing && !q.answer && (
        <div className="mt-2">
          <PublishButton q={q} busy={busy === 'publish'} run={run} />
        </div>
      )}
    </article>
  );
}

function PublishButton({ q, busy, run }: { q: AdminQuestion; busy: boolean; run: ReturnType<typeof useAction>['run'] }) {
  return (
    <Button
      size="sm"
      variant="outline"
      loading={busy}
      onClick={() =>
        run('publish', () => patch(`/admin/questions/${q.id}`, { isPublished: !q.isPublished }), q.isPublished ? 'Question hidden from the store' : 'Question published')
      }
    >
      {q.isPublished ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      {q.isPublished ? 'Unpublish' : 'Publish'}
    </Button>
  );
}
