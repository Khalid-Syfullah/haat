'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { Button, Field, Input, Modal, Select, Textarea } from '@/components/ui';
import { post } from '@/lib/api';
import { dateTime, tk } from '@/lib/format';
import { paymentLabel, ReturnStatusBadge, Thumb } from './bits';
import { Switch } from './controls';
import { useAction } from './use-action';

export interface AdminReturn {
  id: string;
  quantity: number;
  reason: string;
  details: string | null;
  images: string[];
  status: string;
  refundAmount: number | null;
  refundMethod: 'ORIGINAL' | 'COINS';
  restock: boolean;
  adminNote: string | null;
  createdAt: string;
  resolvedAt: string | null;
  orderItem: { title: string; variantLabel: string | null; imageUrl: string | null; unitPrice: number; quantity: number };
  order: { id: string; orderNo: string; paymentMethod: string };
  user: { name: string; phone: string };
}

type Dialog = 'reject' | 'receive' | 'refund' | null;

export function ReturnCard({ r }: { r: AdminReturn }) {
  const { run, busy } = useAction();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const max = r.orderItem.unitPrice * r.quantity;

  const decide = (action: string, body: Record<string, unknown>, success: string) =>
    run(action, () => post(`/admin/returns/${r.id}/decision`, { action, ...body }), success).then((ok) => {
      if (ok) setDialog(null);
    });

  return (
    <article className="rounded-[6px] border border-line bg-white">
      <div className="flex flex-wrap items-start gap-4 p-4">
        <Thumb src={r.orderItem.imageUrl} size={64} />
        <div className="min-w-0 flex-1 basis-60">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-ink">{r.orderItem.title}</h3>
            <ReturnStatusBadge status={r.status} />
          </div>
          <p className="text-sm text-ink-soft">
            {r.orderItem.variantLabel ? `${r.orderItem.variantLabel}, ` : ''}
            Returning {r.quantity} of {r.orderItem.quantity}, worth {tk(max)}
          </p>
          <p className="mt-2 text-[15px] text-ink">
            <span className="font-medium">{r.reason}</span>
          </p>
          {r.details && <p className="mt-0.5 text-sm whitespace-pre-line text-ink">{r.details}</p>}
          {r.images.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {r.images.map((src, i) => (
                <button key={src} type="button" onClick={() => setPhoto(src)} className="rounded focus-visible:outline-2 focus-visible:outline-marigold" aria-label={`Open photo ${i + 1}`}>
                  <Thumb src={src} size={56} />
                </button>
              ))}
            </div>
          )}
          {r.adminNote && (
            <p className="mt-2 rounded bg-paper px-2 py-1 text-sm text-ink">
              <span className="text-ink-soft">Staff note:</span> {r.adminNote}
            </p>
          )}
          {r.status === 'REFUNDED' && r.refundAmount !== null && (
            <p className="mt-2 text-sm text-padma-dark">
              Refunded {tk(r.refundAmount)} {r.refundMethod === 'COINS' ? 'as coins' : `to ${paymentLabel(r.order.paymentMethod)}`}
              {r.resolvedAt ? ` on ${dateTime(r.resolvedAt)}` : ''}
            </p>
          )}
        </div>
        <dl className="w-full space-y-0.5 text-sm sm:w-56">
          <div>
            <dt className="sr-only">Customer</dt>
            <dd className="font-medium text-ink">{r.user.name}</dd>
            <dd className="text-ink-soft tabular-nums">{r.user.phone}</dd>
          </div>
          <div>
            <dt className="sr-only">Order</dt>
            <dd>
              <Link href={`/admin/orders/${r.order.id}`} className="font-medium text-padma hover:underline">
                Order {r.order.orderNo}
              </Link>
            </dd>
            <dd className="text-ink-soft">Paid by {paymentLabel(r.order.paymentMethod)}</dd>
          </div>
          <div>
            <dt className="sr-only">Requested</dt>
            <dd className="text-xs text-ink-soft">Requested {dateTime(r.createdAt)}</dd>
          </div>
        </dl>
      </div>

      {['REQUESTED', 'APPROVED', 'RECEIVED'].includes(r.status) && (
        <div className="flex flex-wrap justify-end gap-2 border-t border-line bg-[#fafbf9] px-4 py-2.5">
          {(r.status === 'REQUESTED' || r.status === 'APPROVED') && (
            <Button size="sm" variant="ghost" className="text-sindoor hover:bg-sindoor-tint hover:text-sindoor" onClick={() => setDialog('reject')}>
              Reject return
            </Button>
          )}
          {r.status === 'REQUESTED' && (
            <Button size="sm" loading={busy === 'approve'} onClick={() => decide('approve', {}, 'Return approved')}>
              Approve return
            </Button>
          )}
          {r.status === 'APPROVED' && (
            <Button size="sm" onClick={() => setDialog('receive')}>
              Mark item received
            </Button>
          )}
          {r.status === 'RECEIVED' && (
            <Button size="sm" onClick={() => setDialog('refund')}>
              Send refund
            </Button>
          )}
        </div>
      )}

      <RejectDialog open={dialog === 'reject'} onClose={() => setDialog(null)} busy={busy === 'reject'} onSubmit={(note) => decide('reject', { note }, 'Return rejected')} />
      <ReceiveDialog
        open={dialog === 'receive'}
        onClose={() => setDialog(null)}
        r={r}
        busy={busy === 'receive'}
        onSubmit={(restock, note) => decide('receive', { restock, ...(note ? { note } : {}) }, restock ? 'Received and put back in stock' : 'Marked as received')}
      />
      <RefundDialog
        open={dialog === 'refund'}
        onClose={() => setDialog(null)}
        r={r}
        max={max}
        busy={busy === 'refund'}
        onSubmit={(refundAmount, refundMethod, note) => decide('refund', { refundAmount, refundMethod, ...(note ? { note } : {}) }, 'Refund sent')}
      />

      <Modal open={!!photo} onClose={() => setPhoto(null)} title="Customer photo" wide>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {photo && <img src={photo} alt="Photo the customer attached to the return" className="mx-auto max-h-[65vh] rounded" />}
      </Modal>
    </article>
  );
}

function RejectDialog({ open, onClose, busy, onSubmit }: { open: boolean; onClose: () => void; busy: boolean; onSubmit: (note: string) => void }) {
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (note.trim().length < 3) return setError('Tell the customer why, so they know what to do next');
    setError(null);
    onSubmit(note.trim());
  };
  return (
    <Modal open={open} onClose={onClose} title="Reject return">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Reason for the customer" error={error} hint="The customer sees this in their notification.">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="e.g. The seal is broken, so we can't accept this item back" aria-invalid={!!error} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button type="submit" variant="danger" loading={busy}>
            Reject return
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function ReceiveDialog({ open, onClose, r, busy, onSubmit }: { open: boolean; onClose: () => void; r: AdminReturn; busy: boolean; onSubmit: (restock: boolean, note: string) => void }) {
  const [restock, setRestock] = useState(r.restock);
  const [note, setNote] = useState('');
  return (
    <Modal open={open} onClose={onClose} title="Mark item received">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(restock, note.trim());
        }}
        className="space-y-4"
      >
        <p className="text-ink">
          Confirm {r.quantity} × {r.orderItem.title} arrived back at the hub.
        </p>
        <div>
          <Switch checked={restock} onChange={setRestock} label={`Put ${r.quantity} back in stock`} />
          <p className="mt-1 text-xs text-ink-soft">Turn this off if the item is damaged and can&apos;t be sold again.</p>
        </div>
        <Field label="Note (optional)">
          <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="e.g. Box opened, item unused" />
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button type="submit" loading={busy}>
            Mark item received
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function RefundDialog({
  open,
  onClose,
  r,
  max,
  busy,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  r: AdminReturn;
  max: number;
  busy: boolean;
  onSubmit: (amount: number, method: 'ORIGINAL' | 'COINS', note: string) => void;
}) {
  const [amount, setAmount] = useState(String(r.refundAmount ?? max));
  const [method, setMethod] = useState<'ORIGINAL' | 'COINS'>(r.refundMethod);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const n = Number(amount);
    if (!Number.isInteger(n) || n < 0) return setError('Enter a whole taka amount');
    if (n > max) return setError(`The most you can refund is ${tk(max)}, what the customer paid for these items`);
    setError(null);
    onSubmit(n, method, note.trim());
  };
  return (
    <Modal open={open} onClose={onClose} title="Send refund">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Amount in taka" error={error} hint={`Paid for ${r.quantity} × ${r.orderItem.title}: ${tk(max)}. Delivery is not refunded.`}>
          <Input type="number" inputMode="numeric" min={0} max={max} step={1} value={amount} onChange={(e) => setAmount(e.target.value)} aria-invalid={!!error} />
        </Field>
        <Field
          label="Refund to"
          hint={method === 'COINS' ? 'Coins are added to their account instantly.' : `Send the money yourself via ${paymentLabel(r.order.paymentMethod)}, then record it here.`}
        >
          <Select value={method} onChange={(e) => setMethod(e.target.value as 'ORIGINAL' | 'COINS')}>
            <option value="ORIGINAL">Original payment method ({paymentLabel(r.order.paymentMethod)})</option>
            <option value="COINS">Haat coins</option>
          </Select>
        </Field>
        <Field label="Note (optional)" hint="For example the bKash transaction ID.">
          <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button type="submit" loading={busy}>
            Send refund
          </Button>
        </div>
      </form>
    </Modal>
  );
}
