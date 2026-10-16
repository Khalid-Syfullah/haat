'use client';

import clsx from 'clsx';
import { Search, X } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, ReactNode, useEffect, useState, useTransition } from 'react';
import { Pagination, Spinner } from '@/components/ui';

/** Returns a function that merges a patch into the current query string and navigates. */
export function useQueryNav() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const go = (patch: Record<string, string | number | null | undefined>, opts: { keepPage?: boolean } = {}) => {
    const sp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined || v === null || v === '') sp.delete(k);
      else sp.set(k, String(v));
    }
    if (!opts.keepPage && !('page' in patch)) sp.delete('page');
    const qs = sp.toString();
    start(() => router.push(qs ? `${pathname}?${qs}` : pathname));
  };
  return { go, pending, params };
}

/** Search box bound to ?q (or another key). Submits on Enter; clearing resets the list. */
export function SearchBox({ placeholder, param = 'q', label = 'Search', className }: { placeholder: string; param?: string; label?: string; className?: string }) {
  const { go, pending, params } = useQueryNav();
  const current = params.get(param) ?? '';
  const [value, setValue] = useState(current);
  useEffect(() => setValue(current), [current]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    go({ [param]: value.trim() });
  };

  return (
    <form role="search" onSubmit={submit} className={clsx('relative w-full min-w-0 sm:w-auto sm:max-w-sm sm:flex-1', className)}>
      <label className="sr-only" htmlFor={`search-${param}`}>
        {label}
      </label>
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-faint" aria-hidden />
      <input
        id={`search-${param}`}
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="h-10 w-full rounded-md border border-line bg-white pr-9 pl-9 text-[15px] text-ink placeholder:text-ink-faint focus:border-padma focus:ring-2 focus:ring-padma/20 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
      />
      {pending ? (
        <Spinner className="absolute top-1/2 right-3 size-4 -translate-y-1/2" />
      ) : (
        current && (
          <button
            type="button"
            onClick={() => {
              setValue('');
              go({ [param]: null });
            }}
            className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-ink-faint hover:text-ink"
            aria-label="Clear search"
          >
            <X className="size-4" />
          </button>
        )
      )}
    </form>
  );
}

/** A labelled select bound to one query param. */
export function FilterSelect({ param, label, options, allLabel = 'All' }: { param: string; label: string; options: { value: string; label: string }[]; allLabel?: string }) {
  const { go, params } = useQueryNav();
  const id = `filter-${param}`;
  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="shrink-0 text-sm text-ink-soft">
        {label}
      </label>
      <select
        id={id}
        value={params.get(param) ?? ''}
        onChange={(e) => go({ [param]: e.target.value })}
        className="h-10 rounded-md border border-line bg-white pr-8 pl-3 text-[15px] text-ink focus:border-padma focus:ring-2 focus:ring-padma/20 focus:outline-none"
      >
        <option value="">{allLabel}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Checkbox chip bound to a boolean query param (?param=true). */
export function FilterToggle({ param, label }: { param: string; label: string }) {
  const { go, params } = useQueryNav();
  const on = params.get(param) === 'true';
  return (
    <label
      className={clsx(
        'inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm font-medium select-none has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-marigold',
        on ? 'border-padma bg-padma-tint text-padma-dark' : 'border-line bg-white text-ink-soft hover:text-ink',
      )}
    >
      <input type="checkbox" className="size-4 accent-padma" checked={on} onChange={() => go({ [param]: on ? null : 'true' })} />
      {label}
    </label>
  );
}

export function UrlPagination({ page, pages }: { page: number; pages: number }) {
  const { go } = useQueryNav();
  return <Pagination page={page} pages={pages} onPage={(p) => go({ page: p > 1 ? p : null })} />;
}

export function Toolbar({ children }: { children: ReactNode }) {
  return <div className="mb-4 flex flex-wrap items-center gap-2">{children}</div>;
}

/** Accessible on/off switch. */
export function Switch({
  checked,
  onChange,
  label,
  disabled,
  srOnlyLabel,
  tone = 'green',
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
  srOnlyLabel?: boolean;
  tone?: 'green' | 'red';
}) {
  return (
    <label className={clsx('inline-flex items-center gap-2 text-sm', disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer')}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={srOnlyLabel ? label : undefined}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={clsx(
          'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors',
          checked ? (tone === 'red' ? 'bg-sindoor' : 'bg-padma') : 'bg-[#cfd5d1]',
        )}
      >
        <span className={clsx('inline-block size-4 rounded-full bg-white transition-transform', checked ? 'translate-x-[18px]' : 'translate-x-0.5')} />
      </button>
      {!srOnlyLabel && <span className="text-ink">{label}</span>}
    </label>
  );
}
