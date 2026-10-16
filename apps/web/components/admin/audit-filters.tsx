'use client';

import { X } from 'lucide-react';
import { useQueryNav } from './controls';

const fieldClass =
  'h-10 w-full min-w-0 rounded-md border border-line bg-white text-[15px] text-ink focus:border-padma focus:ring-2 focus:ring-padma/20 focus:outline-none sm:w-auto';

/** Label above the control on phones (two to a row), beside it on wider screens. */
function Labelled({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
      <label htmlFor={htmlFor} className="shrink-0 text-sm text-ink-soft">
        {label}
      </label>
      {children}
    </div>
  );
}

/** Select bound to one query param. */
export function AuditSelect({ param, label, options, allLabel }: { param: string; label: string; options: { value: string; label: string }[]; allLabel: string }) {
  const { go, params } = useQueryNav();
  const id = `audit-${param}`;
  const value = params.get(param) ?? '';
  // Keep a filter that came from a link (e.g. Staff → last change) visible even if it has no entries.
  const known = !value || options.some((o) => o.value === value);
  return (
    <Labelled label={label} htmlFor={id}>
      <select id={id} value={value} onChange={(e) => go({ [param]: e.target.value })} className={`${fieldClass} pr-8 pl-3`}>
        <option value="">{allLabel}</option>
        {!known && <option value={value}>Selected</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Labelled>
  );
}

/** From / to date inputs bound to ?from and ?to (YYYY-MM-DD, Dhaka days). */
export function AuditDateRange() {
  const { go, params } = useQueryNav();
  const from = params.get('from') ?? '';
  const to = params.get('to') ?? '';

  return (
    <>
      <Labelled label="From" htmlFor="audit-from">
        <input id="audit-from" type="date" value={from} max={to || undefined} onChange={(e) => go({ from: e.target.value })} className={`${fieldClass} px-2.5 tabular-nums`} />
      </Labelled>
      <Labelled label="To" htmlFor="audit-to">
        <input id="audit-to" type="date" value={to} min={from || undefined} onChange={(e) => go({ to: e.target.value })} className={`${fieldClass} px-2.5 tabular-nums`} />
      </Labelled>
      {(from || to) && (
        <button
          type="button"
          onClick={() => go({ from: null, to: null })}
          className="col-span-2 inline-flex h-10 items-center gap-1 justify-self-start rounded-md px-2 text-sm text-ink-soft hover:bg-black/5 hover:text-ink sm:self-end"
        >
          <X className="size-4" aria-hidden />
          Clear dates
        </button>
      )}
    </>
  );
}

/** Lays filters out two to a row on phones and in one wrapping row on wider screens. */
export function AuditFilterGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center">{children}</div>;
}
