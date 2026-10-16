/** Server-safe helpers shared by the catalog and marketing admin pages. */
import clsx from 'clsx';
import { ImagePlus } from 'lucide-react';
import { ReactNode } from 'react';
import { Badge } from '@/components/ui';
import { ApiError } from '@/lib/api';

/** White work panel used across the catalog pages. */
export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx('rounded-[6px] border border-line bg-white', className)}>{children}</div>;
}

export function PanelTitle({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-2 border-b border-line px-4 py-3">
      <div>
        <h2 className="font-semibold text-ink">{title}</h2>
        {description && <p className="text-sm text-ink-soft">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export const th = 'whitespace-nowrap border-b border-line bg-paper/70 px-3 py-2 text-left text-xs font-semibold text-ink-soft';
export const thNum = clsx(th, 'text-right');
export const td = 'border-b border-line px-3 py-2.5 align-middle';
export const tdNum = clsx(td, 'text-right tabular-nums');

export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error) return e.message;
  return 'Something went wrong';
}

export function Thumb({ src, alt = '', size = 40, className }: { src?: string | null; alt?: string; size?: number; className?: string }) {
  return (
    <span
      className={clsx('inline-flex shrink-0 items-center justify-center overflow-hidden rounded border border-line bg-paper', className)}
      style={{ width: size, height: size }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} className="size-full object-cover" />
      ) : (
        <ImagePlus className="size-4 text-ink-faint" aria-hidden />
      )}
    </span>
  );
}

// ───── Categories ─────

export interface CategoryRow {
  id: string;
  name: string;
  nameBn: string | null;
  slug: string;
  parentId: string | null;
  icon: string | null;
  imageUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  productCount: number;
}

/** Depth-first order of the category tree with depth for indenting. */
export function flattenCategories<T extends { id: string; parentId: string | null }>(rows: T[]): (T & { depth: number; childCount: number })[] {
  const ids = new Set(rows.map((r) => r.id));
  const kids = new Map<string | null, T[]>();
  for (const r of rows) {
    const key = r.parentId && ids.has(r.parentId) ? r.parentId : null;
    kids.set(key, [...(kids.get(key) ?? []), r]);
  }
  const out: (T & { depth: number; childCount: number })[] = [];
  const walk = (parent: string | null, depth: number, seen: Set<string>) => {
    for (const r of kids.get(parent) ?? []) {
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      out.push({ ...r, depth, childCount: (kids.get(r.id) ?? []).length });
      walk(r.id, depth + 1, seen);
    }
  };
  walk(null, 0, new Set());
  return out;
}

export function indent(depth: number) {
  return '    '.repeat(depth);
}

export function CategoryOptions({ categories, exclude }: { categories: CategoryRow[]; exclude?: Set<string> }) {
  return (
    <>
      {flattenCategories(categories)
        .filter((c) => !exclude?.has(c.id))
        .map((c) => (
          <option key={c.id} value={c.id}>
            {indent(c.depth)}
            {c.name}
            {c.isActive ? '' : ' (hidden)'}
          </option>
        ))}
    </>
  );
}

// ───── Dates: the store runs on Bangladesh time (UTC+6, no DST) ─────

const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000;

/** ISO → value for <input type="datetime-local"> in Asia/Dhaka. */
export function toDhakaInput(iso: string | Date | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Date(d.getTime() + DHAKA_OFFSET_MS).toISOString().slice(0, 16);
}

/** datetime-local value read as Asia/Dhaka time → ISO string. */
export function fromDhakaInput(value: string): string | null {
  if (!value) return null;
  const d = new Date(`${value}:00+06:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export type Phase = 'off' | 'scheduled' | 'live' | 'ended';

export function phaseOf(startsAt: string | null, endsAt: string | null, isActive: boolean, now = Date.now()): Phase {
  if (!isActive) return 'off';
  if (startsAt && now < new Date(startsAt).getTime()) return 'scheduled';
  if (endsAt && now >= new Date(endsAt).getTime()) return 'ended';
  return 'live';
}

export function PhaseBadge({ phase, liveLabel = 'Live' }: { phase: Phase; liveLabel?: string }) {
  if (phase === 'live') return <Badge tone="green">{liveLabel}</Badge>;
  if (phase === 'scheduled') return <Badge tone="amber">Scheduled</Badge>;
  if (phase === 'ended') return <Badge tone="red">Ended</Badge>;
  return <Badge>Switched off</Badge>;
}

export const toInt = (v: string) => (v.trim() === '' ? NaN : Number(v));
export const isWhole = (n: number) => Number.isInteger(n);
