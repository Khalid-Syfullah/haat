'use client';

import { History, Minus, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { useToast } from '@/components/providers';
import { Badge, Button, clsx, Field, Input, Modal, Spinner } from '@/components/ui';
import { api, post } from '@/lib/api';
import { dateTime } from '@/lib/format';
import { errorMessage, td, tdNum, th, thNum } from './utils';

interface Movement {
  id: string;
  delta: number;
  reason: 'ORDER' | 'CANCEL' | 'RETURN' | 'RESTOCK' | 'ADJUSTMENT' | 'DELIVERY_FAILED';
  note: string | null;
  refId: string | null;
  createdAt: string;
}

const REASON_LABEL: Record<Movement['reason'], string> = {
  ORDER: 'Order',
  CANCEL: 'Order cancelled',
  RETURN: 'Return',
  RESTOCK: 'Restock',
  ADJUSTMENT: 'Adjustment',
  DELIVERY_FAILED: 'Delivery failed',
};

export function InventoryActions({ variant }: { variant: { id: string; sku: string; stock: number; name: string } }) {
  const [open, setOpen] = useState<'adjust' | 'history' | null>(null);
  return (
    <div className="flex justify-end gap-1">
      <Button variant="outline" size="sm" onClick={() => setOpen('adjust')}>
        Adjust
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setOpen('history')}>
        <History className="size-4" aria-hidden />
        History
      </Button>
      {open === 'adjust' && <AdjustModal variant={variant} onClose={() => setOpen(null)} />}
      {open === 'history' && <HistoryModal variant={variant} onClose={() => setOpen(null)} />}
    </div>
  );
}

function AdjustModal({ variant, onClose }: { variant: { id: string; sku: string; stock: number; name: string }; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [dir, setDir] = useState<1 | -1>(1);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<{ amount?: string; note?: string }>({});

  const n = Number(amount);
  const valid = Number.isInteger(n) && n > 0;
  const after = valid ? variant.stock + dir * n : variant.stock;

  async function submit(e: FormEvent) {
    e.preventDefault();
    const errs: typeof errors = {};
    if (!valid) errs.amount = 'Enter a whole number above 0';
    else if (after < 0) errs.amount = `Only ${variant.stock} in stock`;
    if (note.trim().length < 2) errs.note = 'Say why the stock is changing';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      const res = await post<{ stock: number }>(`/admin/inventory/${variant.id}/adjust`, { delta: dir * n, note: note.trim() });
      toast(`Stock for ${variant.sku} is now ${res.stock}`);
      onClose();
      router.refresh();
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Adjust stock">
      <form onSubmit={submit} className="grid gap-4 text-left" noValidate>
        <div>
          <p className="font-medium text-ink">{variant.name}</p>
          <p className="text-sm text-ink-soft">
            <span className="font-mono">{variant.sku}</span>, {variant.stock} in stock now
          </p>
        </div>
        <div role="radiogroup" aria-label="Direction" className="grid grid-cols-2 gap-2">
          {([1, -1] as const).map((d) => (
            <button
              key={d}
              type="button"
              role="radio"
              aria-checked={dir === d}
              onClick={() => setDir(d)}
              className={clsx(
                'flex h-10 items-center justify-center gap-2 rounded-md border text-[15px] font-semibold',
                dir === d ? (d === 1 ? 'border-padma bg-padma-tint text-padma-dark' : 'border-sindoor bg-sindoor-tint text-sindoor') : 'border-line text-ink-soft hover:border-ink-faint',
              )}
            >
              {d === 1 ? <Plus className="size-4" aria-hidden /> : <Minus className="size-4" aria-hidden />}
              {d === 1 ? 'Add stock' : 'Remove stock'}
            </button>
          ))}
        </div>
        <Field label="Amount" error={errors.amount} hint={valid ? `Stock after: ${after}` : undefined}>
          <Input type="number" inputMode="numeric" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
        </Field>
        <Field label="Reason" error={errors.note} hint="e.g. New shipment from supplier, damaged in warehouse, stock count">
          <Input value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={busy}>
            Save adjustment
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function HistoryModal({ variant, onClose }: { variant: { id: string; sku: string; name: string }; onClose: () => void }) {
  const [rows, setRows] = useState<Movement[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    api<Movement[]>(`/admin/inventory/${variant.id}/movements`)
      .then((r) => live && setRows(r))
      .catch((e) => live && setError(errorMessage(e)));
    return () => {
      live = false;
    };
  }, [variant.id]);

  return (
    <Modal open onClose={onClose} title="Stock history" wide>
      <div className="text-left">
        <p className="font-medium text-ink">{variant.name}</p>
        <p className="mb-4 font-mono text-sm text-ink-soft">{variant.sku}</p>
        {error ? (
          <p className="text-sindoor">{error}</p>
        ) : !rows ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : rows.length === 0 ? (
          <p className="py-6 text-center text-ink-soft">No stock movements recorded yet.</p>
        ) : (
          <div className="relative overflow-x-auto rounded-[6px] border border-line">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr>
                  <th className={th}>Date</th>
                  <th className={thNum}>Change</th>
                  <th className={th}>Reason</th>
                  <th className={th}>Note</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((m) => (
                  <tr key={m.id}>
                    <td className={`${td} whitespace-nowrap text-ink-soft`}>{dateTime(m.createdAt)}</td>
                    <td className={clsx(tdNum, 'font-semibold', m.delta > 0 ? 'text-padma' : 'text-sindoor')}>
                      {m.delta > 0 ? '+' : '−'}
                      {Math.abs(m.delta)}
                    </td>
                    <td className={td}>
                      <Badge tone={m.reason === 'RESTOCK' || m.reason === 'RETURN' || m.reason === 'CANCEL' ? 'green' : m.reason === 'ORDER' ? 'blue' : 'neutral'}>{REASON_LABEL[m.reason] ?? m.reason}</Badge>
                    </td>
                    <td className={`${td} text-ink-soft`}>{m.note ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Modal>
  );
}
