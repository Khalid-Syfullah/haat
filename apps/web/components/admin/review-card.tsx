'use client';

import { Eye, EyeOff, Reply } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Badge, Button, Modal, Stars, Textarea } from '@/components/ui';
import { patch } from '@/lib/api';
import { dateTime } from '@/lib/format';
import { Thumb } from './bits';
import { useAction } from './use-action';

export interface AdminReview {
  id: string;
  rating: number;
  comment: string;
  images: string[];
  status: 'PUBLISHED' | 'HIDDEN';
  reply: string | null;
  repliedAt: string | null;
  createdAt: string;
  user: { name: string; phone: string };
  product: { title: string; slug: string };
}

export function ReviewCard({ r }: { r: AdminReview }) {
  const { run, busy } = useAction();
  const [editing, setEditing] = useState(false);
  const [reply, setReply] = useState(r.reply ?? '');
  const [photo, setPhoto] = useState<string | null>(null);
  const hidden = r.status === 'HIDDEN';

  const saveReply = async (value: string | null, msg: string) => {
    const ok = await run('reply', () => patch(`/admin/reviews/${r.id}`, { reply: value }), msg);
    if (ok) setEditing(false);
  };

  return (
    <article className={`rounded-[6px] border border-line bg-white p-4 ${hidden ? 'bg-[#fafbf9]' : ''}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <Link href={`/product/${r.product.slug}#reviews`} target="_blank" className="font-semibold text-ink hover:text-padma hover:underline">
            {r.product.title}
          </Link>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-ink-soft">
            <Stars value={r.rating} />
            <span>{r.user.name}</span>
            <span className="tabular-nums">{r.user.phone}</span>
            <span>{dateTime(r.createdAt)}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hidden ? <Badge tone="neutral">Hidden from store</Badge> : <Badge tone="green">Published</Badge>}
          {!r.reply && <Badge tone="amber">No reply</Badge>}
        </div>
      </div>

      {r.comment ? <p className="mt-2 text-[15px] whitespace-pre-line text-ink">{r.comment}</p> : <p className="mt-2 text-sm text-ink-faint">Rating only, no comment.</p>}

      {r.images.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {r.images.map((src, i) => (
            <button key={src} type="button" onClick={() => setPhoto(src)} className="rounded focus-visible:outline-2 focus-visible:outline-marigold" aria-label={`Open photo ${i + 1}`}>
              <Thumb src={src} size={56} />
            </button>
          ))}
        </div>
      )}

      {editing ? (
        <form
          className="mt-3 space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (reply.trim()) saveReply(reply.trim(), r.reply ? 'Reply updated' : 'Reply posted');
          }}
        >
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-ink">Reply from the store</span>
            <Textarea value={reply} onChange={(e) => setReply(e.target.value)} maxLength={1000} autoFocus className="min-h-20" placeholder="Thank the customer, or explain how you will fix the problem" />
          </label>
          <div className="flex flex-wrap justify-end gap-2">
            {r.reply && (
              <Button type="button" size="sm" variant="ghost" className="mr-auto text-sindoor hover:bg-sindoor-tint hover:text-sindoor" loading={busy === 'reply' && !reply} onClick={() => saveReply(null, 'Reply removed')}>
                Remove reply
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setReply(r.reply ?? '');
                setEditing(false);
              }}
            >
              Discard
            </Button>
            <Button type="submit" size="sm" loading={busy === 'reply'} disabled={!reply.trim()}>
              {r.reply ? 'Save reply' : 'Post reply'}
            </Button>
          </div>
          <p className="text-xs text-ink-soft">The customer gets a notification when you reply. Replies show under the review on the product page.</p>
        </form>
      ) : (
        r.reply && (
          <div className="mt-3 rounded-md border-l-2 border-padma bg-padma-tint/50 px-3 py-2">
            <p className="text-xs font-semibold text-padma-dark">Store reply{r.repliedAt ? `, ${dateTime(r.repliedAt)}` : ''}</p>
            <p className="text-sm whitespace-pre-line text-ink">{r.reply}</p>
          </div>
        )
      )}

      {!editing && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
            <Reply className="size-4" /> {r.reply ? 'Edit reply' : 'Reply'}
          </Button>
          <Button
            size="sm"
            variant="outline"
            loading={busy === 'status'}
            onClick={() =>
              run('status', () => patch(`/admin/reviews/${r.id}`, { status: hidden ? 'PUBLISHED' : 'HIDDEN' }), hidden ? 'Review published' : 'Review hidden from the store')
            }
          >
            {hidden ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
            {hidden ? 'Publish review' : 'Hide review'}
          </Button>
        </div>
      )}

      <Modal open={!!photo} onClose={() => setPhoto(null)} title="Review photo" wide>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {photo && <img src={photo} alt="Photo attached to the review" className="mx-auto max-h-[65vh] rounded" />}
      </Modal>
    </article>
  );
}
