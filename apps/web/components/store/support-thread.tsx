'use client';

import clsx from 'clsx';
import { CircleCheck, Send } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { ApiError, post } from '@/lib/api';
import { dateTime } from '@/lib/format';
import { useToast } from '../providers';
import { Button, Modal, Textarea } from '../ui';
import { PhotoPicker } from './order-actions';
import type { SupportMessage, TicketStatus } from './support-bits';

/** Chat-style thread: the customer on the right, Haat support on the left. */
export function SupportMessages({ messages }: { messages: SupportMessage[] }) {
  const [photo, setPhoto] = useState<string | null>(null);
  return (
    <>
      <ol className="space-y-4" aria-label="Messages">
        {messages.map((m) => {
          const mine = !m.fromStaff;
          return (
            <li key={m.id} className={clsx('flex', mine ? 'justify-end' : 'justify-start')}>
              <div className={clsx('flex max-w-[88%] flex-col sm:max-w-[75%]', mine ? 'items-end' : 'items-start')}>
                <p className="mb-1 px-1 text-xs font-semibold text-ink-soft">{m.author}</p>
                <div
                  className={clsx(
                    'rounded-2xl px-3.5 py-2.5 text-[15px] leading-relaxed',
                    mine ? 'rounded-br-sm bg-padma-tint text-ink' : 'rounded-bl-sm border border-line bg-white text-ink shadow-[0_1px_0_rgba(0,0,0,0.03)]',
                  )}
                >
                  <p className="whitespace-pre-line break-words [overflow-wrap:anywhere]">{m.body}</p>
                  {m.images.length > 0 && (
                    <div className={clsx('mt-2 flex flex-wrap gap-1.5', mine && 'justify-end')}>
                      {m.images.map((src, i) => (
                        <button
                          key={src}
                          type="button"
                          onClick={() => setPhoto(src)}
                          className="size-20 overflow-hidden rounded-md border border-line bg-paper hover:opacity-90"
                          aria-label={`Open photo ${i + 1} full size`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={src} alt="" className="size-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <p className="mt-1 px-1 text-xs text-ink-faint">{dateTime(m.createdAt)}</p>
              </div>
            </li>
          );
        })}
      </ol>
      <Modal open={!!photo} onClose={() => setPhoto(null)} title="Photo" wide>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {photo && <img src={photo} alt="Photo attached to this request" className="mx-auto max-h-[65vh] rounded" />}
      </Modal>
    </>
  );
}

export function SupportReplyBox({ ticketNo, status }: { ticketNo: string; status: TicketStatus }) {
  const router = useRouter();
  const toast = useToast();
  const [body, setBody] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [busy, setBusy] = useState<'reply' | 'resolve' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const resolved = status === 'RESOLVED';

  async function send(e: FormEvent) {
    e.preventDefault();
    if (!body.trim()) return setError('Write a message first');
    setError(null);
    setBusy('reply');
    try {
      await post(`/support/tickets/${ticketNo}/messages`, { body: body.trim(), images });
      setBody('');
      setImages([]);
      toast(resolved ? "Request opened again. We'll reply soon." : "Message sent. We'll reply soon.");
      router.refresh();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not send your message', 'error');
    } finally {
      setBusy(null);
    }
  }

  async function resolve() {
    setBusy('resolve');
    try {
      await post(`/support/tickets/${ticketNo}/resolve`);
      toast('Marked as resolved. Glad we could help.');
      router.refresh();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not update the request', 'error');
    } finally {
      setBusy(null);
    }
  }

  return (
    <form onSubmit={send} noValidate className="space-y-3">
      <label className="block">
        <span className="mb-1 block text-sm font-medium">{resolved ? 'Need more help? Reply to open it again' : 'Your reply'}</span>
        <Textarea
          value={body}
          onChange={(e) => {
            setBody(e.target.value);
            if (error) setError(null);
          }}
          rows={3}
          maxLength={4000}
          placeholder="Write a message"
          aria-invalid={!!error}
        />
        {error && <span className="mt-1 block text-sm text-sindoor">{error}</span>}
      </label>
      <PhotoPicker value={images} onChange={setImages} max={5} />
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
        {!resolved ? (
          <Button type="button" variant="outline" onClick={resolve} loading={busy === 'resolve'} disabled={busy === 'reply'}>
            {busy !== 'resolve' && <CircleCheck className="size-4" aria-hidden />}
            Mark as resolved
          </Button>
        ) : (
          <span />
        )}
        <Button type="submit" loading={busy === 'reply'} disabled={busy === 'resolve'}>
          {busy !== 'reply' && <Send className="size-4" aria-hidden />}
          Send
        </Button>
      </div>
    </form>
  );
}
