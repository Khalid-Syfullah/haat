'use client';

import { ChevronRight } from 'lucide-react';
import { Fragment, useState } from 'react';
import { clsx } from '@/components/ui';
import { tk } from '@/lib/format';
import { Table, TableWrap, Td, Th } from '../bits';
import { pct, ShareBar } from './parts';

export interface CategoryLine {
  id: string;
  name: string;
  slug: string;
  orders: number;
  units: number;
  revenue: number;
  share: number;
}

/** Top-level categories with their sub-categories folded underneath. */
export function CategoryTable({ items }: { items: (CategoryLine & { children: CategoryLine[] })[] }) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const withKids = items.filter((c) => c.children.length);
  const allOpen = withKids.length > 0 && withKids.every((c) => open.has(c.id));
  const toggle = (id: string) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <>
      {withKids.length > 0 && (
        <div className="flex justify-end border-b border-line px-4 py-2">
          <button
            type="button"
            className="text-sm font-medium text-padma hover:underline"
            onClick={() => setOpen(allOpen ? new Set() : new Set(withKids.map((c) => c.id)))}
          >
            {allOpen ? 'Hide sub-categories' : 'Show all sub-categories'}
          </button>
        </div>
      )}
      <TableWrap>
        <Table>
          <thead>
            <tr>
              <Th>Category</Th>
              <Th align="right">Orders</Th>
              <Th align="right">Units</Th>
              <Th align="right">Revenue</Th>
              <Th>Share of revenue</Th>
            </tr>
          </thead>
          <tbody>
            {items.map((c) => {
              const isOpen = open.has(c.id);
              return (
                <Fragment key={c.id}>
                  <tr className="hover:bg-paper/60">
                    <Td className="min-w-48">
                      {c.children.length ? (
                        <button
                          type="button"
                          onClick={() => toggle(c.id)}
                          aria-expanded={isOpen}
                          className="inline-flex items-center gap-1.5 text-left font-medium text-ink hover:text-padma"
                        >
                          <ChevronRight className={clsx('size-4 shrink-0 text-ink-faint transition-transform', isOpen && 'rotate-90')} aria-hidden />
                          {c.name}
                          <span className="text-xs font-normal text-ink-soft">({c.children.length})</span>
                        </button>
                      ) : (
                        <span className="pl-[22px] font-medium text-ink">{c.name}</span>
                      )}
                    </Td>
                    <Td num>{c.orders}</Td>
                    <Td num>{c.units}</Td>
                    <Td num className="font-medium whitespace-nowrap">
                      {tk(c.revenue)}
                    </Td>
                    <Td className="whitespace-nowrap">
                      <span className="flex items-center gap-2">
                        <ShareBar value={c.share} />
                        <span className="w-12 text-right text-ink-soft tabular-nums">{pct(c.share)}</span>
                      </span>
                    </Td>
                  </tr>
                  {isOpen &&
                    c.children.map((s) => (
                      <tr key={s.id} className="bg-paper/40">
                        <Td className="text-ink-soft first:pl-[42px]">{s.name}</Td>
                        <Td num className="text-ink-soft">
                          {s.orders}
                        </Td>
                        <Td num className="text-ink-soft">
                          {s.units}
                        </Td>
                        <Td num className="whitespace-nowrap text-ink-soft">
                          {tk(s.revenue)}
                        </Td>
                        <Td className="whitespace-nowrap">
                          <span className="flex items-center gap-2">
                            <ShareBar value={s.share} muted />
                            <span className="w-12 text-right text-ink-soft tabular-nums">{pct(s.share)}</span>
                          </span>
                        </Td>
                      </tr>
                    ))}
                </Fragment>
              );
            })}
          </tbody>
        </Table>
      </TableWrap>
    </>
  );
}
