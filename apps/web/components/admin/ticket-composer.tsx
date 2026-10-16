'use client';

import { CircleCheck, Send } from 'lucide-react';
import { FormEvent, useRef, useState } from 'react';
import { PhotoPicker } from '@/components/store/order-actions';
import { Button, Textarea } from '@/components/ui';
import { post } from '@/lib/api';
import type { TicketDetail, TicketStatus } from './ticket-bits';
import { useAction } from './use-action';

function snippets(firstName: string) {
  return [
    { label: 'Greeting', text: `Hi ${firstName}, thanks for writing to us.` },
    { label: 'Thanks for waiting', text: 'Thanks for waiting, and sorry for the delay.' },
    { label: 'Checking', text: "We're checking this now and will update you here within a day." },
    { label: 'Ask for a photo', text: 'Could you send a photo of the item and the parcel label? It helps us sort this out quickly.' },
    { label: 'Courier', text: 'We have asked the courier about your parcel. They will call you before delivering.' },
    { label: 'Refund', text: 'Your refund is on its way. It usually reaches you within 3 to 5 working days.' },
    { label: 'Anything else', text: 'Is there anything else we can help with?' },
  ];
}

export function TicketComposer({ id, customerName, status }: { id: string; customerName: string; status: TicketStatus }) {
  const { run, busy } = useAction();
  const [body, setBody] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLTextAreaElement>(null);
  const firstName = customerName.split(/\s+/)[0] || 'there';

  function insert(text: string) {
    setBody((b) => (b.trim() ? `${b.replace(/\s+$/, '')}\n\n${text}` : text));
    setError(null);
    requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    });
  }

  async function send(next: 'PENDING' | 'RESOLVED') {
    if (!body.trim()) {
      setError('Write a reply first');
      ref.current?.focus();
      return;
    }
    setError(null);
    const ok = await run(
      next,
      () => post<TicketDetail>(`/admin/tickets/${id}/messages`, { body: body.trim(), images, status: next }),
      next === 'RESOLVED' ? 'Reply sent and ticket resolved' : 'Reply sent',
    );
    if (ok) {
      setBody('');
      setImages([]);
    }
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    send('PENDING');
  };

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-3">
      <div>
        <p className="mb-1.5 text-xs font-medium text-ink-soft">Quick replies</p>
        <div className="flex flex-wrap gap-1.5">
          {snippets(firstName).map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={() => insert(s.text)}
              title={s.text}
              className="rounded-full border border-line bg-white px-2.5 py-1 text-xs font-medium text-ink-soft hover:border-padma hover:text-padma"
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
      <label className="block">
        <span className="sr-only">Reply to {customerName}</span>
        <Textarea
          ref={ref}
          value={body}
          onChange={(e) => {
            setBody(e.target.value);
            if (error) setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              send('PENDING');
            }
          }}
          rows={5}
          maxLength={4000}
          placeholder={`Write to ${firstName}`}
          aria-invalid={!!error}
        />
        {error && <span className="mt-1 block text-sm text-sindoor">{error}</span>}
      </label>
      <PhotoPicker value={images} onChange={setImages} max={5} />
      <div className="flex flex-col gap-3 border-t border-line pt-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-ink-soft">
          {customerName} gets a notification and an SMS.{status === 'RESOLVED' ? ' Sending a reply reopens the ticket.' : ''}
        </p>
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => send('RESOLVED')} loading={busy === 'RESOLVED'} disabled={!!busy && busy !== 'RESOLVED'}>
            {busy !== 'RESOLVED' && <CircleCheck className="size-4" aria-hidden />}
            Send and resolve
          </Button>
          <Button type="submit" loading={busy === 'PENDING'} disabled={!!busy && busy !== 'PENDING'}>
            {busy !== 'PENDING' && <Send className="size-4" aria-hidden />}
            Send reply
          </Button>
        </div>
      </div>
    </form>
  );
}
