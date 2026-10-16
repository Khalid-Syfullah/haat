'use client';

import clsx from 'clsx';
import { LayoutGrid, Search } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, useEffect, useId, useRef, useState } from 'react';
import { api } from '@/lib/api';

interface Suggestions {
  products: { title: string; slug: string }[];
  categories: { name: string; slug: string }[];
}

export function SearchBox({ className }: { className?: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Suggestions>({ products: [], categories: [] });
  const [active, setActive] = useState(-1);
  const listId = useId();
  const boxRef = useRef<HTMLFormElement>(null);

  useEffect(() => setQ(params.get('q') ?? ''), [params]);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setData({ products: [], categories: [] });
      return;
    }
    const t = setTimeout(async () => {
      try {
        setData(await api<Suggestions>(`/search/suggest?q=${encodeURIComponent(term)}`));
      } catch {
        /* suggestions are optional */
      }
    }, 180);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const close = (e: MouseEvent) => !boxRef.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const options = [
    ...data.categories.map((c) => ({ key: `c-${c.slug}`, label: c.name, href: `/category/${c.slug}`, kind: 'category' as const })),
    ...data.products.map((p) => ({ key: `p-${p.slug}`, label: p.title, href: `/product/${p.slug}`, kind: 'product' as const })),
  ];

  function submit(e: FormEvent) {
    e.preventDefault();
    setOpen(false);
    if (active >= 0 && options[active]) return router.push(options[active].href);
    const term = q.trim();
    router.push(term ? `/search?q=${encodeURIComponent(term)}` : '/search');
  }

  return (
    <form ref={boxRef} onSubmit={submit} role="search" className={clsx('relative', className)}>
      <div className="flex h-11 overflow-hidden rounded-md bg-white ring-2 ring-transparent focus-within:ring-marigold">
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActive((a) => Math.min(options.length - 1, a + 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((a) => Math.max(-1, a - 1));
            } else if (e.key === 'Escape') setOpen(false);
          }}
          placeholder="Search in Bangla or English, e.g. মোবাইল, panjabi"
          aria-label="Search products"
          aria-autocomplete="list"
          aria-controls={listId}
          aria-expanded={open && options.length > 0}
          role="combobox"
          className="min-w-0 flex-1 px-4 text-[15px] text-ink placeholder:text-ink-faint focus:outline-none"
        />
        <button type="submit" className="flex w-14 items-center justify-center bg-marigold text-ink hover:bg-[#e09d00]" aria-label="Search">
          <Search className="size-5" strokeWidth={2.5} />
        </button>
      </div>
      {open && options.length > 0 && (
        <ul id={listId} role="listbox" className="absolute inset-x-0 top-12 z-50 overflow-hidden rounded-md border border-line bg-white py-1 shadow-lg">
          {options.map((o, i) => (
            <li key={o.key} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setOpen(false);
                  router.push(o.href);
                }}
                className={clsx('flex w-full items-center gap-3 px-4 py-2 text-left text-[15px]', i === active ? 'bg-padma-tint' : 'hover:bg-paper')}
              >
                {o.kind === 'category' ? <LayoutGrid className="size-4 shrink-0 text-padma" /> : <Search className="size-4 shrink-0 text-ink-faint" />}
                <span className="truncate">
                  {o.label}
                  {o.kind === 'category' && <span className="ml-2 text-sm text-ink-soft">in categories</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
