'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState, useTransition } from 'react';
import { Button, clsx, Spinner } from '@/components/ui';
import { hrefWith } from '../bits';
import { daysBetween, isDay, PRESETS } from './range';

/** Preset links plus a custom from/to form. Everything lives in the URL so the server renders the report. */
export function RangePicker({ from, to, active, today, keep }: { from: string; to: string; active: string | null; today: string; keep: Record<string, string | undefined> }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [f, setF] = useState(from);
  const [t, setT] = useState(to);
  const [error, setError] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!isDay(f) || !isDay(t)) return setError('Pick both dates');
    if (f > t) return setError('The start date must be on or before the end date');
    if (daysBetween(f, t) > 731) return setError('Pick two years or less');
    setError(null);
    start(() => router.push(hrefWith('/admin/reports', keep, { range: null, from: f, to: t })));
  };

  return (
    <div className="mb-4 rounded-[6px] border border-line bg-white p-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <nav className="flex flex-wrap gap-1.5" aria-label="Date range">
          {PRESETS.map((p) => {
            const on = p.key === active;
            return (
              <Link
                key={p.key}
                href={hrefWith('/admin/reports', keep, { range: p.key === '30d' ? null : p.key, from: null, to: null })}
                aria-current={on ? 'true' : undefined}
                className={clsx(
                  'inline-flex h-9 items-center rounded-md border px-3 text-sm font-medium whitespace-nowrap',
                  on ? 'border-padma bg-padma-tint text-padma-dark' : 'border-line text-ink-soft hover:border-ink-faint hover:text-ink',
                )}
              >
                {p.label}
              </Link>
            );
          })}
        </nav>
        <form onSubmit={submit} className="flex flex-wrap items-end gap-2" noValidate aria-label="Custom dates">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink-soft">From</span>
            <input
              type="date"
              value={f}
              max={today}
              onChange={(e) => setF(e.target.value)}
              className="h-9 rounded-md border border-line bg-white px-2 text-sm text-ink focus:border-padma focus:ring-2 focus:ring-padma/20 focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink-soft">To</span>
            <input
              type="date"
              value={t}
              max={today}
              onChange={(e) => setT(e.target.value)}
              className="h-9 rounded-md border border-line bg-white px-2 text-sm text-ink focus:border-padma focus:ring-2 focus:ring-padma/20 focus:outline-none"
            />
          </label>
          <Button type="submit" size="sm" variant="outline" className="h-9" disabled={pending || (f === from && t === to)}>
            {pending ? <Spinner className="size-4" /> : 'Apply'}
          </Button>
        </form>
      </div>
      {error && (
        <p className="mt-2 text-sm text-sindoor" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
