/**
 * Server-safe admin building blocks (no hooks, no 'use client').
 * Import from server pages and client components alike.
 */
import clsx from 'clsx';
import { ImageOff } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Badge } from '@/components/ui';
import { ORDER_STATUS_LABEL, PAYMENT_LABEL, PAYMENT_STATUS_LABEL, RETURN_STATUS_LABEL } from '@/lib/format';

export type Tone = 'neutral' | 'green' | 'amber' | 'red' | 'blue';

export const ORDER_STATUSES = ['AWAITING_PAYMENT', 'PLACED', 'CONFIRMED', 'PACKED', 'SHIPPED', 'DELIVERED', 'DELIVERY_FAILED', 'CANCELLED'] as const;
export const RETURN_STATUSES = ['REQUESTED', 'APPROVED', 'RECEIVED', 'REFUNDED', 'REJECTED'] as const;

const ORDER_TONE: Record<string, Tone> = {
  AWAITING_PAYMENT: 'neutral',
  PLACED: 'amber',
  CONFIRMED: 'neutral',
  PACKED: 'neutral',
  SHIPPED: 'blue',
  DELIVERED: 'green',
  CANCELLED: 'red',
  DELIVERY_FAILED: 'red',
};

const PAYMENT_TONE: Record<string, Tone> = {
  UNPAID: 'neutral',
  PENDING: 'neutral',
  PAID: 'green',
  FAILED: 'red',
  REFUND_PENDING: 'amber',
  REFUNDED: 'neutral',
};

const RETURN_TONE: Record<string, Tone> = {
  REQUESTED: 'amber',
  APPROVED: 'blue',
  RECEIVED: 'amber',
  REFUNDED: 'green',
  REJECTED: 'red',
};

export function OrderStatusBadge({ status }: { status: string }) {
  return <Badge tone={ORDER_TONE[status] ?? 'neutral'}>{ORDER_STATUS_LABEL[status] ?? status}</Badge>;
}

export function PaymentStatusBadge({ status }: { status: string }) {
  return <Badge tone={PAYMENT_TONE[status] ?? 'neutral'}>{PAYMENT_STATUS_LABEL[status] ?? status}</Badge>;
}

export function ReturnStatusBadge({ status }: { status: string }) {
  return <Badge tone={RETURN_TONE[status] ?? 'neutral'}>{RETURN_STATUS_LABEL[status] ?? status}</Badge>;
}

export function paymentLabel(method: string) {
  return PAYMENT_LABEL[method] ?? method;
}

/** COD refusal risk, coloured against the store's call / advance-payment thresholds. */
export function RiskBadge({ score, callAt = 40, advanceAt = 70 }: { score: number; callAt?: number; advanceAt?: number }) {
  const tone: Tone = score >= advanceAt ? 'red' : score >= callAt ? 'amber' : 'green';
  const word = score >= advanceAt ? 'High' : score >= callAt ? 'Medium' : 'Low';
  return (
    <Badge tone={tone} className="tabular-nums">
      {word} {score}
    </Badge>
  );
}

/** White work card. Optional title row with actions. */
export function Panel({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
  id,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  id?: string;
}) {
  return (
    <section id={id} className={clsx('rounded-[6px] border border-line bg-white', className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
          <div>
            {title && <h2 className="text-base font-semibold text-ink">{title}</h2>}
            {description && <p className="text-sm text-ink-soft">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

/**
 * Scrolls inside the card: sideways on phones, and on larger screens long lists
 * scroll under a sticky header row.
 */
export function TableWrap({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx('overflow-auto sm:max-h-[calc(100dvh-11rem)]', className)}>{children}</div>;
}

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return <table className={clsx('w-full border-collapse text-sm', className)}>{children}</table>;
}

export function Th({ children, align = 'left', className }: { children?: ReactNode; align?: 'left' | 'right' | 'center'; className?: string }) {
  return (
    <th
      scope="col"
      className={clsx(
        'whitespace-nowrap border-b border-line bg-[#f8f9f7] px-3 py-2.5 text-xs font-semibold text-ink-soft first:pl-4 last:pr-4 sticky top-0 z-10',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
        align === 'left' && 'text-left',
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({ children, align = 'left', className, num }: { children?: ReactNode; align?: 'left' | 'right' | 'center'; className?: string; num?: boolean }) {
  return (
    <td
      className={clsx(
        'border-b border-line px-3 py-2.5 align-middle first:pl-4 last:pr-4',
        (num || align === 'right') && 'text-right tabular-nums',
        align === 'center' && 'text-center',
        className,
      )}
    >
      {children}
    </td>
  );
}

/** Product / upload thumbnail with a quiet fallback. */
export function Thumb({ src, alt = '', size = 40, className }: { src?: string | null; alt?: string; size?: number; className?: string }) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      loading="lazy"
      className={clsx('shrink-0 rounded border border-line bg-paper object-cover', className)}
      style={{ width: size, height: size }}
    />
  ) : (
    <span
      className={clsx('inline-flex shrink-0 items-center justify-center rounded border border-line bg-paper text-ink-faint', className)}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <ImageOff className="size-4" />
    </span>
  );
}

/** Label / value pair rows for summaries. */
export function Row({ label, children, strong, className }: { label: ReactNode; children: ReactNode; strong?: boolean; className?: string }) {
  return (
    <div className={clsx('flex items-baseline justify-between gap-4 py-1', strong && 'font-semibold text-ink', className)}>
      <dt className={clsx(strong ? 'text-ink' : 'text-ink-soft')}>{label}</dt>
      <dd className="text-right tabular-nums">{children}</dd>
    </div>
  );
}

/** Pill tabs that are plain links, so the server renders the filtered list. */
export function LinkTabs({ tabs, active, label }: { tabs: { key: string; label: string; href: string; count?: number }[]; active: string; label: string }) {
  return (
    <nav className="no-scrollbar -mx-4 mb-4 flex gap-1 overflow-x-auto px-4 sm:mx-0 sm:px-0" aria-label={label}>
      {tabs.map((t) => {
        const on = t.key === active;
        return (
          <Link
            key={t.key}
            href={t.href}
            aria-current={on ? 'page' : undefined}
            className={clsx(
              'inline-flex shrink-0 items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium',
              on ? 'border-padma bg-padma text-white' : 'border-line bg-white text-ink-soft hover:border-ink-faint hover:text-ink',
            )}
          >
            {t.label}
            {t.count !== undefined && (
              <span className={clsx('rounded px-1.5 text-xs tabular-nums', on ? 'bg-white/20 text-white' : 'bg-black/5 text-ink-soft')}>{t.count}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

/** Builds `path?query` from current params plus a patch; empty values are dropped. */
export function hrefWith(path: string, current: Record<string, string | undefined>, patch: Record<string, string | number | undefined | null>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...current, ...patch })) {
    if (v !== undefined && v !== null && v !== '') sp.set(k, String(v));
  }
  const qs = sp.toString();
  return qs ? `${path}?${qs}` : path;
}

/** Normalises Next's searchParams record to plain strings. */
export function flatParams(sp: Record<string, string | string[] | undefined>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(sp)) {
    const val = Array.isArray(v) ? v[0] : v;
    if (val) out[k] = val;
  }
  return out;
}

export function ErrorPanel({ title = 'Could not load this page', body = 'The server did not respond. Refresh in a moment.' }: { title?: string; body?: string }) {
  return (
    <div className="rounded-[6px] border border-sindoor/30 bg-sindoor-tint px-4 py-3 text-sm text-sindoor" role="alert">
      <p className="font-semibold">{title}</p>
      <p>{body}</p>
    </div>
  );
}
