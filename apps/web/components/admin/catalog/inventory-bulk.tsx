'use client';

import { BellRing, X } from 'lucide-react';
import { createContext, FormEvent, ReactNode, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useToast } from '@/components/providers';
import { Button, Input, Modal, Select } from '@/components/ui';
import { post } from '@/lib/api';
import { useAction } from '../use-action';

type Action = 'stock_set' | 'stock_add' | 'price_set' | 'price_change_pct' | 'sale_set' | 'sale_pct_off' | 'sale_clear' | 'activate' | 'deactivate';

const ACTIONS: { value: Action; label: string; unit?: '৳' | '%' | 'units'; hint?: string }[] = [
  { value: 'stock_set', label: 'Set stock to…', unit: 'units', hint: 'Units on hand after the change' },
  { value: 'stock_add', label: 'Add or remove stock…', unit: 'units', hint: 'Use a minus sign to remove, e.g. -5' },
  { value: 'price_set', label: 'Set price to…', unit: '৳', hint: 'Regular price in taka' },
  { value: 'price_change_pct', label: 'Change price by %…', unit: '%', hint: '-90 to 500. Use a minus sign to lower' },
  { value: 'sale_set', label: 'Set sale price to…', unit: '৳', hint: 'Must be below each price' },
  { value: 'sale_pct_off', label: 'Discount from price by %…', unit: '%', hint: '1 to 90% off the regular price' },
  { value: 'sale_clear', label: 'Remove sale price' },
  { value: 'activate', label: 'Show in store' },
  { value: 'deactivate', label: 'Hide from store' },
];

const CONFIRM_OVER = 20;
const isStock = (a: Action | '') => a === 'stock_set' || a === 'stock_add';

/** What's wrong with the value, or null. */
function check(action: Action, raw: string): string | null {
  const meta = ACTIONS.find((a) => a.value === action);
  if (!meta?.unit) return null;
  if (raw.trim() === '') return 'Enter a value';
  const n = Number(raw);
  if (!Number.isInteger(n)) return 'Use a whole number';
  switch (action) {
    case 'stock_set':
      return n < 0 ? 'Stock cannot be below 0' : null;
    case 'stock_add':
      return n === 0 ? 'Enter how many to add or remove' : null;
    case 'price_set':
    case 'sale_set':
      return n < 1 ? 'Prices start at ৳1' : null;
    case 'price_change_pct':
      return n === 0 || n < -90 || n > 500 ? 'Use -90 to 500, not 0' : null;
    case 'sale_pct_off':
      return n < 1 || n > 90 ? 'Use 1 to 90' : null;
  }
  return null;
}

function describe(action: Action, value: number, count: number) {
  const skus = `${count} SKU${count === 1 ? '' : 's'}`;
  switch (action) {
    case 'stock_set':
      return `Set stock to ${value} on ${skus}.`;
    case 'stock_add':
      return value > 0 ? `Add ${value} to the stock of ${skus}.` : `Remove ${-value} from the stock of ${skus}.`;
    case 'price_set':
      return `Set the price of ${skus} to ৳${value}.`;
    case 'price_change_pct':
      return `${value > 0 ? 'Raise' : 'Lower'} the price of ${skus} by ${Math.abs(value)}%.`;
    case 'sale_set':
      return `Set the sale price of ${skus} to ৳${value}.`;
    case 'sale_pct_off':
      return `Put ${skus} on sale at ${value}% off their price.`;
    case 'sale_clear':
      return `Remove the sale price from ${skus}.`;
    case 'activate':
      return `Show ${skus} in the store.`;
    case 'deactivate':
      return `Hide ${skus} from the store. Hidden SKUs drop off this list.`;
  }
}

interface Selection {
  ids: string[];
  selected: Set<string>;
  toggle: (id: string) => void;
  setAll: (on: boolean) => void;
  clear: () => void;
}

const Ctx = createContext<Selection | null>(null);

function useSelection() {
  const s = useContext(Ctx);
  if (!s) throw new Error('Inventory checkboxes must sit inside <BulkSelection>');
  return s;
}

/** Wraps the server-rendered inventory table: holds the ticked SKUs and shows the action bar under it. */
export function BulkSelection({ ids, children }: { ids: string[]; children: ReactNode }) {
  const [picked, setPicked] = useState<Set<string>>(new Set());
  // Rows that left the page (after a refresh or a filter) drop out of the selection.
  const selected = useMemo(() => new Set(ids.filter((id) => picked.has(id))), [ids, picked]);
  const value: Selection = {
    ids,
    selected,
    toggle: (id) =>
      setPicked((s) => {
        const n = new Set(s);
        if (n.has(id)) n.delete(id);
        else n.add(id);
        return n;
      }),
    setAll: (on) => setPicked(on ? new Set(ids) : new Set()),
    clear: () => setPicked(new Set()),
  };
  return (
    <Ctx.Provider value={value}>
      {children}
      <BulkBar />
    </Ctx.Provider>
  );
}

export function SelectAllBox() {
  const { ids, selected, setAll } = useSelection();
  const ref = useRef<HTMLInputElement>(null);
  const all = ids.length > 0 && selected.size === ids.length;
  const some = selected.size > 0 && !all;
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = some;
  }, [some]);
  return (
    <input
      ref={ref}
      type="checkbox"
      className="size-4 cursor-pointer align-middle accent-padma"
      checked={all}
      onChange={() => setAll(!all)}
      aria-label="Select all on this page"
      title="Select all on this page"
    />
  );
}

export function RowBox({ id, label }: { id: string; label: string }) {
  const { selected, toggle } = useSelection();
  return (
    <input
      type="checkbox"
      className="size-4 cursor-pointer align-middle accent-padma"
      checked={selected.has(id)}
      onChange={() => toggle(id)}
      aria-label={`Select ${label}`}
    />
  );
}

function BulkBar() {
  const { selected, clear } = useSelection();
  const { run, busy } = useAction();
  const toast = useToast();
  const [action, setAction] = useState<Action | ''>('');
  const [value, setValue] = useState('');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<{ action?: string; value?: string; note?: string }>({});
  const [confirm, setConfirm] = useState(false);

  const count = selected.size;
  if (count === 0) return null;
  const meta = ACTIONS.find((a) => a.value === action);

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    const errs: typeof errors = {};
    if (!action) errs.action = 'Choose what to change';
    else {
      const v = check(action, value);
      if (v) errs.value = v;
      if (isStock(action) && (note.trim().length < 2 || note.trim().length > 200)) errs.note = 'Say why stock is changing';
    }
    setErrors(errs);
    if (Object.keys(errs).length) return;
    if (count > CONFIRM_OVER && !confirm) return setConfirm(true);
    void apply();
  };

  const apply = async () => {
    if (!action) return;
    const body = { variantIds: [...selected], action, ...(meta?.unit ? { value: Number(value) } : {}), ...(isStock(action) ? { note: note.trim() } : {}) };
    const res = await run('bulk', () => post<{ updated: number }>('/admin/inventory/bulk', body));
    setConfirm(false);
    if (!res) return;
    toast(`Updated ${res.updated} SKU${res.updated === 1 ? '' : 's'}`);
    clear();
    setValue('');
    setNote('');
  };

  return (
    <div className="sticky bottom-0 z-20 border-t border-line bg-white px-4 py-3 shadow-[0_-6px_16px_-8px_rgba(23,33,43,0.18)]" role="region" aria-label="Change selected SKUs">
      <form onSubmit={submit} className="flex flex-wrap items-start gap-x-3 gap-y-2" noValidate>
        <div className="flex h-10 w-full items-center gap-2 sm:w-auto">
          <span className="font-semibold text-ink tabular-nums">{count} selected</span>
          <button type="button" onClick={clear} className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-sm text-ink-soft hover:bg-black/5 hover:text-ink">
            <X className="size-3.5" aria-hidden /> Clear selection
          </button>
        </div>
        <div className="w-full sm:w-56">
          <Select
            value={action}
            onChange={(e) => {
              setAction(e.target.value as Action | '');
              setErrors({});
            }}
            aria-label="What to change"
            aria-invalid={!!errors.action}
          >
            <option value="">Choose a change…</option>
            <optgroup label="Stock">
              {ACTIONS.slice(0, 2).map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </optgroup>
            <optgroup label="Price">
              {ACTIONS.slice(2, 7).map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </optgroup>
            <optgroup label="In the store">
              {ACTIONS.slice(7).map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </optgroup>
          </Select>
          {errors.action && <span className="mt-1 block text-sm text-sindoor">{errors.action}</span>}
        </div>
        {meta?.unit && (
          <div className="w-[calc(50%-6px)] sm:w-36">
            <div className="relative">
              {meta.unit === '৳' && <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-soft">৳</span>}
              <Input
                type="number"
                inputMode="numeric"
                step={1}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                aria-label={`${meta.label.replace('…', '')} (${meta.unit === 'units' ? 'units' : meta.unit === '%' ? 'percent' : 'taka'})`}
                aria-invalid={!!errors.value}
                className={meta.unit === '৳' ? 'pl-7' : meta.unit === '%' ? 'pr-8' : 'pr-12'}
              />
              {meta.unit !== '৳' && (
                <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-ink-soft">{meta.unit === '%' ? '%' : 'units'}</span>
              )}
            </div>
            <span className={errors.value ? 'mt-1 block text-sm text-sindoor' : 'mt-1 block text-xs text-ink-soft'}>{errors.value ?? meta.hint}</span>
          </div>
        )}
        {isStock(action) && (
          <div className="w-full sm:w-auto sm:min-w-0 sm:flex-1 sm:basis-56 sm:max-w-xs">
            <Input value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder="Why is stock changing?" aria-label="Reason for the stock change" aria-invalid={!!errors.note} />
            <span className={errors.note ? 'mt-1 block text-sm text-sindoor' : 'mt-1 block text-xs text-ink-soft'}>{errors.note ?? 'Saved in each SKU’s stock history'}</span>
          </div>
        )}
        <Button type="submit" loading={busy === 'bulk' && !confirm} className={meta?.unit ? 'flex-1 sm:ml-auto sm:flex-none' : 'w-full sm:ml-auto sm:w-auto'}>
          Apply to {count}
        </Button>
      </form>
      <p className="mt-2 flex items-start gap-1.5 text-xs text-ink-soft">
        <BellRing className="mt-px size-3.5 shrink-0" aria-hidden />
        Price cuts and restocks notify customers who asked for a price drop or back-in-stock alert.
      </p>

      {confirm && action && (
        <Modal open onClose={() => setConfirm(false)} title={`Change ${count} SKUs?`}>
          <p className="text-ink">{describe(action, Number(value), count)}</p>
          <p className="mt-2 text-sm text-ink-soft">This applies to every selected SKU at once. If any one of them can&apos;t take the change, nothing is changed.</p>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirm(false)} disabled={busy === 'bulk'}>
              Cancel
            </Button>
            <Button loading={busy === 'bulk'} onClick={apply}>
              Apply to {count} SKUs
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
