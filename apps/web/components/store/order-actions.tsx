'use client';

import { ImagePlus, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { ApiError, post, uploadImage } from '@/lib/api';
import { useToast } from '../providers';
import { Button, Field, Modal, Select, Textarea } from '../ui';

export function PayNowButton({ orderNo }: { orderNo: string }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="deal"
      loading={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const res = await post<{ redirectUrl: string }>(`/payments/${orderNo}/initiate`, {}, { 'idempotency-key': crypto.randomUUID() });
          window.location.href = res.redirectUrl;
        } catch (e) {
          toast(e instanceof ApiError ? e.message : 'Could not start the payment', 'error');
          setBusy(false);
        }
      }}
    >
      Pay now
    </Button>
  );
}

const CANCEL_REASONS = ['Ordered by mistake', 'Found a better price', 'Delivery takes too long', 'Want to change the address or items', 'Other'];

export function CancelOrderButton({ orderNo }: { orderNo: string }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(CANCEL_REASONS[0]);
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await post(`/orders/${orderNo}/cancel`, { reason });
      toast('Order cancelled');
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not cancel the order', 'error');
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        Cancel order
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Cancel this order?">
        <form onSubmit={submit} className="space-y-4">
          <p className="text-[15px] text-ink-soft">Items go back on sale. Any coins and vouchers you used are returned to your account, and online payments are refunded.</p>
          <Field label="Reason">
            <Select value={reason} onChange={(e) => setReason(e.target.value)}>
              {CANCEL_REASONS.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </Select>
          </Field>
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setOpen(false)}>
              Keep order
            </Button>
            <Button type="submit" variant="danger" className="flex-1" loading={busy}>
              Cancel order
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}

export function PhotoPicker({ value, onChange, max = 5 }: { value: string[]; onChange: (v: string[]) => void; max?: number }) {
  const toast = useToast();
  const [uploading, setUploading] = useState(false);
  return (
    <div className="flex flex-wrap gap-2">
      {value.map((url) => (
        <span key={url} className="relative size-16 overflow-hidden rounded border border-line">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="" className="size-full object-cover" />
          <button type="button" onClick={() => onChange(value.filter((v) => v !== url))} className="absolute right-0.5 top-0.5 rounded-full bg-ink/70 p-0.5 text-white" aria-label="Remove photo">
            <X className="size-3" />
          </button>
        </span>
      ))}
      {value.length < max && (
        <label className="flex size-16 cursor-pointer flex-col items-center justify-center rounded border-2 border-dashed border-line text-xs text-ink-soft hover:border-padma hover:text-padma">
          <ImagePlus className="size-5" />
          {uploading ? 'Uploading' : 'Add photo'}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            disabled={uploading}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (!file) return;
              setUploading(true);
              try {
                onChange([...value, await uploadImage(file)]);
              } catch (err) {
                toast(err instanceof ApiError ? err.message : 'Upload failed', 'error');
              } finally {
                setUploading(false);
              }
            }}
          />
        </label>
      )}
    </div>
  );
}

export function ReturnButton({ item, reasons }: { item: { id: string; title: string; returnableQty: number; returnUntil: string | null }; reasons: string[] }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(reasons[0] ?? 'Damaged or defective');
  const [qty, setQty] = useState(1);
  const [details, setDetails] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await post('/returns', { orderItemId: item.id, quantity: qty, reason, details: details || undefined, images });
      toast('Return requested. We will review it within 2 working days.');
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not request the return', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="text-sm font-semibold text-padma hover:underline">
        Return item
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Return an item">
        <form onSubmit={submit} className="space-y-4">
          <p className="text-[15px] font-medium">{item.title}</p>
          <div className="grid grid-cols-[1fr_100px] gap-3">
            <Field label="Reason">
              <Select value={reason} onChange={(e) => setReason(e.target.value)}>
                {reasons.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </Select>
            </Field>
            <Field label="Quantity">
              <Select value={qty} onChange={(e) => setQty(Number(e.target.value))}>
                {Array.from({ length: item.returnableQty }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="What happened? (optional)">
            <Textarea value={details} onChange={(e) => setDetails(e.target.value)} rows={3} maxLength={1000} />
          </Field>
          <div>
            <p className="mb-1 text-sm font-medium">Photos of the item</p>
            <PhotoPicker value={images} onChange={setImages} />
            <p className="mt-1 text-xs text-ink-soft">Photos of damage or the wrong item speed up approval.</p>
          </div>
          <Button type="submit" block loading={busy}>
            Request return
          </Button>
        </form>
      </Modal>
    </>
  );
}
