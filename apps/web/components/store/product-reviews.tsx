'use client';

import clsx from 'clsx';
import { Camera, MessageCircleQuestion } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { api, ApiError, post } from '@/lib/api';
import { date } from '@/lib/format';
import { useSession, useToast } from '../providers';
import { Button, EmptyState, Pagination, Stars, Textarea } from '../ui';

interface ReviewPage {
  summary: { avg: number; count: number; breakdown: Record<string, number>; withPhotos: number };
  items: { id: string; rating: number; comment: string; images: string[]; reply: string | null; createdAt: string; author: string; variantLabel: string | null }[];
  total: number;
  page: number;
  pages: number;
}

export function ProductReviews({ slug, initial }: { slug: string; initial: ReviewPage }) {
  const [data, setData] = useState(initial);
  const [filter, setFilter] = useState<{ rating?: number; withPhotos?: boolean }>({});
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState<string | null>(null);

  useEffect(() => {
    if (page === 1 && !filter.rating && !filter.withPhotos) {
      setData(initial);
      return;
    }
    const q = new URLSearchParams({ page: String(page) });
    if (filter.rating) q.set('rating', String(filter.rating));
    if (filter.withPhotos) q.set('withPhotos', 'true');
    api<ReviewPage>(`/products/${slug}/reviews?${q}`).then(setData);
  }, [slug, page, filter, initial]);

  const s = data.summary;
  const chip = (on: boolean) => clsx('rounded-full border px-3 py-1 text-sm', on ? 'border-padma bg-padma-tint font-semibold text-padma-dark' : 'border-line hover:border-ink-faint');

  return (
    <section id="reviews" className="scroll-mt-32 rounded-[var(--radius-card)] border border-line bg-white p-4 sm:p-5" aria-labelledby="reviews-title">
      <h2 id="reviews-title" className="mb-4 text-lg font-semibold">
        Ratings and reviews
      </h2>
      {s.count === 0 ? (
        <EmptyState title="No reviews yet" body="Buyers can review this product after it's delivered." />
      ) : (
        <>
          <div className="flex flex-wrap gap-8 border-b border-line pb-5">
            <div>
              <p className="text-5xl font-bold leading-none">
                {s.avg}
                <span className="text-xl font-medium text-ink-faint">/5</span>
              </p>
              <Stars value={s.avg} size={20} className="mt-2" />
              <p className="mt-1 text-sm text-ink-soft">{s.count} verified buyer reviews</p>
            </div>
            <div className="min-w-56 flex-1 space-y-1">
              {[5, 4, 3, 2, 1].map((r) => {
                const n = s.breakdown[r] ?? 0;
                return (
                  <div key={r} className="flex items-center gap-2 text-sm">
                    <span className="w-3 text-right text-ink-soft">{r}</span>
                    <Stars value={1} size={12} className="[&>span:not(:first-child)]:hidden" />
                    <div className="h-2 max-w-72 flex-1 overflow-hidden rounded-full bg-paper">
                      <div className="h-full rounded-full bg-marigold" style={{ width: `${s.count ? (n / s.count) * 100 : 0}%` }} />
                    </div>
                    <span className="w-6 text-ink-soft">{n}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="my-4 flex flex-wrap gap-2">
            <button className={chip(!filter.rating && !filter.withPhotos)} onClick={() => (setFilter({}), setPage(1))}>
              All
            </button>
            {s.withPhotos > 0 && (
              <button className={chip(!!filter.withPhotos)} onClick={() => (setFilter({ withPhotos: true }), setPage(1))}>
                <Camera className="mr-1 inline size-3.5" />
                With photos ({s.withPhotos})
              </button>
            )}
            {[5, 4, 3, 2, 1].map((r) =>
              (s.breakdown[r] ?? 0) > 0 ? (
                <button key={r} className={chip(filter.rating === r)} onClick={() => (setFilter({ rating: r }), setPage(1))}>
                  {r} star
                </button>
              ) : null,
            )}
          </div>
          <ul className="divide-y divide-line">
            {data.items.map((r) => (
              <li key={r.id} className="py-4">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <Stars value={r.rating} size={14} />
                  <span className="text-sm font-semibold">{r.author}</span>
                  <span className="text-sm text-padma">Verified purchase</span>
                  <span className="ml-auto text-sm text-ink-faint">{date(r.createdAt)}</span>
                </div>
                {r.variantLabel && <p className="mt-0.5 text-sm text-ink-faint">{r.variantLabel}</p>}
                {r.comment && <p className="mt-1.5 max-w-3xl text-[15px]">{r.comment}</p>}
                {r.images.length > 0 && (
                  <div className="mt-2 flex gap-2">
                    {r.images.map((img) => (
                      <button key={img} onClick={() => setZoom(img)} className="size-20 overflow-hidden rounded border border-line" aria-label="Open photo">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={img} alt="" className="size-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
                {r.reply && (
                  <div className="mt-2 max-w-3xl rounded-md bg-paper px-3 py-2 text-sm">
                    <span className="font-semibold text-padma">Reply from Haat: </span>
                    {r.reply}
                  </div>
                )}
              </li>
            ))}
          </ul>
          <div className="mt-2">
            <Pagination page={data.page} pages={data.pages} onPage={setPage} />
          </div>
        </>
      )}
      {zoom && (
        <button className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-6" onClick={() => setZoom(null)} aria-label="Close photo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={zoom} alt="" className="max-h-full max-w-full rounded" />
        </button>
      )}
    </section>
  );
}

interface QuestionPage {
  items: { id: string; question: string; answer: string | null; answeredAt: string | null; createdAt: string; author: string }[];
  total: number;
  page: number;
  pages: number;
}

export function ProductQuestions({ slug, initial }: { slug: string; initial: QuestionPage }) {
  const { user } = useSession();
  const toast = useToast();
  const [data, setData] = useState(initial);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [mine, setMine] = useState<{ id: string; question: string }[]>([]);

  async function ask(e: FormEvent) {
    e.preventDefault();
    if (!user) return (window.location.href = `/login?next=/product/${slug}%23questions`);
    setBusy(true);
    try {
      const q = await post<{ id: string; question: string }>(`/products/${slug}/questions`, { question: text });
      setMine((m) => [q, ...m]);
      setText('');
      toast('Question sent. We usually answer within a day.');
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not send your question', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function goto(page: number) {
    setData(await api<QuestionPage>(`/products/${slug}/questions?page=${page}`));
  }

  return (
    <section id="questions" className="scroll-mt-32 rounded-[var(--radius-card)] border border-line bg-white p-4 sm:p-5" aria-labelledby="qa-title">
      <h2 id="qa-title" className="mb-3 text-lg font-semibold">
        Questions about this product ({data.total})
      </h2>
      <form onSubmit={ask} className="flex flex-col gap-2 sm:flex-row sm:items-start">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={user ? 'Ask about size, warranty, compatibility…' : 'Log in to ask a question'}
          className="min-h-11! flex-1"
          rows={1}
          minLength={5}
          maxLength={300}
          aria-label="Your question"
        />
        <Button type="submit" loading={busy} disabled={!!user && text.trim().length < 5}>
          {user ? 'Ask question' : 'Log in to ask'}
        </Button>
      </form>
      <ul className="mt-4 divide-y divide-line">
        {mine.map((q) => (
          <li key={q.id} className="py-3 text-[15px]">
            <p className="flex gap-2">
              <MessageCircleQuestion className="mt-0.5 size-5 shrink-0 text-padma" />
              <span>{q.question}</span>
            </p>
            <p className="ml-7 mt-1 text-sm text-ink-soft">Waiting for an answer from the store</p>
          </li>
        ))}
        {data.items.map((q) => (
          <li key={q.id} className="py-3 text-[15px]">
            <p className="flex gap-2">
              <MessageCircleQuestion className="mt-0.5 size-5 shrink-0 text-padma" />
              <span>{q.question}</span>
            </p>
            {q.answer ? (
              <p className="ml-7 mt-1 text-ink-soft">
                <span className="font-semibold text-ink">Haat: </span>
                {q.answer}
              </p>
            ) : (
              <p className="ml-7 mt-1 text-sm text-ink-faint">Not answered yet</p>
            )}
            <p className="ml-7 mt-1 text-xs text-ink-faint">
              {q.author}, {date(q.createdAt)}
            </p>
          </li>
        ))}
      </ul>
      {data.items.length === 0 && mine.length === 0 && <p className="py-4 text-ink-soft">No questions yet. Ask the first one.</p>}
      <Pagination page={data.page} pages={data.pages} onPage={goto} />
    </section>
  );
}
