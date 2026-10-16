'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { ApiError, post } from '@/lib/api';
import { date, tk } from '@/lib/format';
import { useToast } from '../providers';
import { Button, Field, Input, Select, Textarea } from '../ui';
import { StatusBadge } from './order-bits';
import { PhotoPicker } from './order-actions';

export interface SupportOrderOption {
  orderNo: string;
  status: string;
  total: number;
  createdAt: string;
  items: { id: string; title: string; imageUrl: string | null }[];
}

type Errors = Partial<Record<'category' | 'subject' | 'message', string>>;

export function NewSupportRequestForm({
  orders,
  categories,
  initialOrder,
}: {
  orders: SupportOrderOption[];
  categories: { value: string; label: string }[];
  initialOrder: string | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [orderNo, setOrderNo] = useState(initialOrder ?? '');
  const [category, setCategory] = useState(initialOrder ? 'ORDER_ISSUE' : '');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const order = orders.find((o) => o.orderNo === orderNo) ?? null;

  function check(): Errors {
    const e: Errors = {};
    if (!category) e.category = 'Choose what your request is about';
    if (subject.trim().length < 4) e.subject = 'Write a short title, at least 4 letters';
    if (message.trim().length < 10) e.message = 'Tell us a little more, at least 10 letters';
    return e;
  }

  async function submit(ev: FormEvent) {
    ev.preventDefault();
    const e = check();
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      const res = await post<{ ticketNo: string }>('/support/tickets', {
        orderNo: orderNo || undefined,
        category,
        subject: subject.trim(),
        message: message.trim(),
        images,
      });
      toast("Request sent. We'll reply here soon.");
      router.push(`/account/support/${res.ticketNo}`);
      router.refresh();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not send your request', 'error');
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4 rounded-[var(--radius-card)] border border-line bg-white p-4 sm:p-5">
      <Field label="Which order is it about?" hint={orders.length === 0 ? 'You have no orders yet, so this request is not linked to one.' : undefined}>
        <Select value={orderNo} onChange={(e) => setOrderNo(e.target.value)} disabled={orders.length === 0}>
          <option value="">Not about an order</option>
          {orders.map((o) => (
            <option key={o.orderNo} value={o.orderNo}>
              {date(o.createdAt)} · {o.items[0]?.title ?? 'Order'}
              {o.items.length > 1 ? ` and ${o.items.length - 1} more` : ''} ({o.orderNo})
            </option>
          ))}
        </Select>
      </Field>

      {order && (
        <div className="flex items-center gap-3 rounded-md bg-paper px-3 py-2">
          <div className="flex -space-x-3">
            {order.items.slice(0, 3).map((i) => (
              <span key={i.id} className="size-11 overflow-hidden rounded border-2 border-white bg-white">
                {i.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={i.imageUrl} alt="" className="size-full object-cover" />
                )}
              </span>
            ))}
          </div>
          <div className="min-w-0 flex-1 text-sm">
            <p className="truncate font-medium text-ink">{order.items.map((i) => i.title).join(', ')}</p>
            <p className="text-ink-soft">
              {order.orderNo} · {tk(order.total)}
            </p>
          </div>
          <StatusBadge status={order.status} />
        </div>
      )}

      <Field label="What is it about?" error={errors.category}>
        <Select value={category} onChange={(e) => setCategory(e.target.value)} aria-invalid={!!errors.category}>
          <option value="" disabled>
            Choose a topic
          </option>
          {categories.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Title" error={errors.subject} hint="A few words, like “The wrong size came”">
        <Input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={120} aria-invalid={!!errors.subject} />
      </Field>

      <Field label="Tell us what happened" error={errors.message} hint={`${message.trim().length}/4000`}>
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={5}
          maxLength={4000}
          aria-invalid={!!errors.message}
          placeholder="What went wrong, and what would you like us to do?"
        />
      </Field>

      <div>
        <p className="mb-1 text-sm font-medium">Photos (optional)</p>
        <PhotoPicker value={images} onChange={setImages} max={5} />
        <p className="mt-1 text-xs text-ink-soft">Up to 5 photos. A photo of the item, the parcel or a screenshot helps us sort it out faster.</p>
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" loading={busy}>
          Send request
        </Button>
      </div>
    </form>
  );
}
