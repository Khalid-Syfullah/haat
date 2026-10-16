/** Server-safe pieces of the reports page. */
import clsx from 'clsx';
import { ArrowDownRight, ArrowUpRight, Download } from 'lucide-react';
import type { ReactNode } from 'react';

/** 12.5 → "12.5%", 12 → "12%" */
export function pct(n: number) {
  return `${Number.isInteger(n) ? n : n.toFixed(1)}%`;
}

export function Tile({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'red' | 'amber' }) {
  return (
    <div className="min-w-0 rounded-[6px] border border-line bg-white px-4 py-3">
      <p className="text-sm text-ink-soft">{label}</p>
      <p className={clsx('mt-0.5 truncate text-2xl font-bold tabular-nums', tone === 'red' ? 'text-sindoor' : tone === 'amber' ? 'text-marigold-dark' : 'text-ink')}>{value}</p>
      {sub && <div className="text-sm text-ink-soft">{sub}</div>}
    </div>
  );
}

/** "+12.4% vs previous 30 days", green when up and red when down. */
export function Change({ value, days }: { value: number | null; days: number }) {
  const period = `previous ${days} day${days === 1 ? '' : 's'}`;
  if (value === null) return <span>Nothing to compare in the {period}</span>;
  if (value === 0) return <span>Same as the {period}</span>;
  const up = value > 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  // Big jumps read better as "12× the previous 30 days" than "+1,100%"
  const times = value >= 200 ? Math.round(1 + value / 100) : null;
  return (
    <span className="inline-flex flex-wrap items-center gap-x-1">
      <span className={clsx('inline-flex items-center font-semibold tabular-nums', up ? 'text-padma' : 'text-sindoor')}>
        <Icon className="size-4" aria-hidden />
        {times ? `${new Intl.NumberFormat('en-IN').format(times)}×` : `${up ? '+' : '−'}${pct(Math.abs(value))}`}
      </span>
      <span>{times ? `the ${period}` : `vs ${period}`}</span>
    </span>
  );
}

/** Thin horizontal bar for a share of a whole (0 to 100). */
export function ShareBar({ value, className, muted }: { value: number; className?: string; muted?: boolean }) {
  return (
    <span className={clsx('inline-block h-1.5 w-20 overflow-hidden rounded-full bg-line align-middle sm:w-28', className)} aria-hidden>
      <span className={clsx('block h-full rounded-full', muted ? 'bg-padma/45' : 'bg-padma')} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </span>
  );
}

/** Plain link to a CSV export; the browser sends the login cookie along. */
export function CsvLink({ href, children = 'Download CSV', button }: { href: string; children?: ReactNode; button?: boolean }) {
  return (
    <a
      href={href}
      download
      className={clsx(
        'inline-flex shrink-0 items-center gap-1.5 font-medium',
        button ? 'h-10 rounded-md border border-line bg-white px-4 text-[15px] font-semibold text-ink hover:border-ink-faint' : 'text-sm text-padma hover:underline',
      )}
    >
      <Download className="size-4" aria-hidden />
      {children}
    </a>
  );
}
