'use client';

import { ImagePlus, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { FormEvent, ReactNode, useRef, useState, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { useToast } from '@/components/providers';
import { Button, clsx, Input, Modal, Pagination, Select, Spinner } from '@/components/ui';
import { uploadImage } from '@/lib/api';
import { errorMessage } from './utils';

/** Checkbox with its label, used for on/off settings. */
export function Toggle({
  label,
  checked,
  onChange,
  hint,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <label className={clsx('flex items-start gap-2.5', disabled ? 'opacity-60' : 'cursor-pointer')}>
      <input
        type="checkbox"
        className="mt-0.5 size-4 shrink-0 accent-padma"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>
        <span className="block text-sm font-medium text-ink">{label}</span>
        {hint && <span className="block text-xs text-ink-soft">{hint}</span>}
      </span>
    </label>
  );
}

/** Single image field: upload, preview and remove. */
export function ImageField({
  label,
  value,
  onChange,
  hint,
  aspect = '1 / 1',
  previewWidth = 120,
}: {
  label: string;
  value: string;
  onChange: (url: string) => void;
  hint?: string;
  aspect?: string;
  previewWidth?: number;
}) {
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function pick(file?: File) {
    if (!file) return;
    setBusy(true);
    try {
      onChange(await uploadImage(file));
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  }

  return (
    <div>
      <span className="mb-1 block text-sm font-medium text-ink">{label}</span>
      <div className="flex flex-wrap items-end gap-3">
        <div
          className="flex items-center justify-center overflow-hidden rounded-[6px] border border-dashed border-line bg-paper"
          style={{ width: previewWidth, aspectRatio: aspect }}
        >
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="" className="size-full object-cover" />
          ) : (
            <ImagePlus className="size-6 text-ink-faint" aria-hidden />
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" loading={busy} onClick={() => input.current?.click()}>
            {value ? 'Replace image' : 'Upload image'}
          </Button>
          {value && (
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange('')}>
              Remove
            </Button>
          )}
        </div>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="sr-only"
        aria-label={`${label} file`}
        onChange={(e) => pick(e.target.files?.[0])}
      />
      {hint && <span className="mt-1 block text-xs text-ink-soft">{hint}</span>}
    </div>
  );
}

/** Confirmation dialog for destructive actions. */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  body: ReactNode;
  confirmLabel: string;
  onConfirm: () => Promise<void> | void;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  // Portalled so a dialog opened from inside a <form> never submits it.
  if (!open) return null;
  return createPortal(
    <Modal open={open} onClose={onClose} title={title}>
      <div className="text-[15px] text-ink-soft">{body}</div>
      <div className="mt-5 flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button
          type="button"
          variant="danger"
          loading={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onConfirm();
            } finally {
              setBusy(false);
            }
          }}
        >
          {confirmLabel}
        </Button>
      </div>
    </Modal>,
    document.body,
  );
}

/** Trash button that asks first. */
export function DeleteButton({
  label = 'Delete',
  title,
  body,
  confirmLabel,
  onConfirm,
  size = 'sm',
  iconOnly,
}: {
  label?: string;
  title: string;
  body: ReactNode;
  confirmLabel: string;
  onConfirm: () => Promise<boolean | void>;
  size?: 'sm' | 'md';
  iconOnly?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant="ghost" size={size} onClick={() => setOpen(true)} aria-label={iconOnly ? label : undefined} className="text-sindoor hover:text-sindoor">
        <Trash2 className="size-4" aria-hidden />
        {!iconOnly && label}
      </Button>
      <ConfirmDialog
        open={open}
        title={title}
        body={body}
        confirmLabel={confirmLabel}
        onClose={() => setOpen(false)}
        onConfirm={async () => {
          const keepOpen = await onConfirm();
          if (keepOpen !== true) setOpen(false);
        }}
      />
    </>
  );
}

// ───── Filters and pagination driven by the URL ─────

export type FilterField =
  | { type: 'search'; name: string; label: string; placeholder?: string }
  | { type: 'select'; name: string; label: string; options: { value: string; label: string }[] }
  | { type: 'toggle'; name: string; label: string };

function buildQuery(values: Record<string, string | undefined>) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(values)) if (v) qs.set(k, v);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export function FilterBar({ basePath, fields, values }: { basePath: string; fields: FilterField[]; values: Record<string, string> }) {
  const router = useRouter();
  const search = fields.find((f) => f.type === 'search');
  const [q, setQ] = useState(search ? (values[search.name] ?? '') : '');
  // Selects and toggles update at once; the server-rendered list follows.
  const [local, setLocal] = useState(values);
  const [pending, startTransition] = useTransition();

  const go = (patchValues: Record<string, string>) => {
    const next = { ...local, ...(search ? { [search.name]: q } : {}), ...patchValues, page: '' };
    setLocal(next);
    startTransition(() => router.push(basePath + buildQuery(next), { scroll: false }));
  };

  return (
    <form
      className="flex flex-wrap items-end gap-3 border-b border-line px-4 py-3"
      aria-busy={pending}
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        go({});
      }}
    >
      {fields.map((f) => {
        if (f.type === 'search')
          return (
            <label key={f.name} className="block flex-[1_1_100%] sm:flex-[1_1_16rem]">
              <span className="mb-1 block text-sm font-medium text-ink">{f.label}</span>
              <span className="flex gap-2">
                <Input type="search" value={q} placeholder={f.placeholder} onChange={(e) => setQ(e.target.value)} />
                <Button type="submit" variant="outline">
                  Search
                </Button>
              </span>
            </label>
          );
        if (f.type === 'select')
          return (
            <label key={f.name} className="block w-full sm:w-auto sm:min-w-44">
              <span className="mb-1 block text-sm font-medium text-ink">{f.label}</span>
              <Select value={local[f.name] ?? ''} onChange={(e) => go({ [f.name]: e.target.value })}>
                {f.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </label>
          );
        return (
          <label key={f.name} className="flex h-10 cursor-pointer items-center gap-2 text-sm font-medium text-ink">
            <input
              type="checkbox"
              className="size-4 accent-padma"
              checked={local[f.name] === '1'}
              onChange={(e) => go({ [f.name]: e.target.checked ? '1' : '' })}
            />
            {f.label}
          </label>
        );
      })}
      {pending && <Spinner className="mb-2.5 size-4" />}
    </form>
  );
}

export function UrlPagination({ basePath, values, page, pages }: { basePath: string; values: Record<string, string>; page: number; pages: number }) {
  const router = useRouter();
  if (pages <= 1) return null;
  return (
    <div className="px-4 py-3">
      <Pagination page={page} pages={pages} onPage={(p) => router.push(basePath + buildQuery({ ...values, page: p > 1 ? String(p) : '' }))} />
    </div>
  );
}

