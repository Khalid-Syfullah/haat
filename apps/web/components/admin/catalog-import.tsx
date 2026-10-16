'use client';

import { CircleCheck, FileSpreadsheet, TriangleAlert, Upload } from 'lucide-react';
import Link from 'next/link';
import { DragEvent, useRef, useState } from 'react';
import { useToast } from '@/components/providers';
import { Badge, Button, clsx, Spinner } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { Panel, Table, TableWrap, Td, Th, type Tone } from './bits';

interface Issue {
  row: number;
  sku?: string;
  message: string;
}

interface Change {
  row: number;
  sku: string;
  product: string;
  action: 'create' | 'update' | 'unchanged';
  details: string[];
}

interface Plan {
  applied: boolean;
  rows: number;
  errors: Issue[];
  changes: Change[];
  summary: { newProducts: number; updatedProducts: number; newVariants: number; updatedVariants: number; unchanged: number; stockChanges: number; newBrands: string[] };
}

const MAX_BYTES = 8 * 1024 * 1024;
const SHOW_MAX = 1000;
const ACTION: Record<Change['action'], { label: string; tone: Tone }> = {
  create: { label: 'New', tone: 'green' },
  update: { label: 'Change', tone: 'blue' },
  unchanged: { label: 'No change', tone: 'neutral' },
};

function isPlan(d: unknown): d is Plan {
  return !!d && typeof d === 'object' && Array.isArray((d as Plan).errors) && Array.isArray((d as Plan).changes) && !!(d as Plan).summary;
}

function size(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString('en-IN')} ${n === 1 ? one : many}`;

/** Upload an .xlsx, see exactly what would change, then apply it. */
export function CatalogImport() {
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<'idle' | 'checking' | 'preview' | 'applying' | 'done'>('idle');
  const [plan, setPlan] = useState<Plan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [showUnchanged, setShowUnchanged] = useState(false);

  const send = (f: File, apply: boolean) => {
    const body = new FormData();
    body.append('file', f);
    return api<Plan>(`/admin/catalog/import${apply ? '?apply=true' : ''}`, { method: 'POST', body });
  };

  const pick = async (f: File | undefined) => {
    if (input.current) input.current.value = '';
    if (!f) return;
    setFile(f);
    setPlan(null);
    setShowUnchanged(false);
    if (!/\.xlsx$/i.test(f.name)) {
      setPhase('idle');
      return setError('Choose an Excel file that ends in .xlsx. Save other formats as "Excel Workbook" first.');
    }
    if (f.size > MAX_BYTES) {
      setPhase('idle');
      return setError(`This file is ${size(f.size)}. Files can be up to 8 MB, so split it into smaller files.`);
    }
    setError(null);
    setPhase('checking');
    try {
      setPlan(await send(f, false));
      setPhase('preview');
    } catch (e) {
      setPhase('idle');
      setError(e instanceof ApiError ? e.message : 'Could not read the file. Try again.');
    }
  };

  const apply = async () => {
    if (!file) return;
    setPhase('applying');
    try {
      const done = await send(file, true);
      setPlan(done);
      setPhase('done');
      toast('Catalog updated');
    } catch (e) {
      setPhase('preview');
      if (e instanceof ApiError && isPlan(e.data)) setPlan({ ...e.data, applied: false });
      toast(e instanceof ApiError ? e.message : 'Could not apply the changes. Try again.', 'error');
    }
  };

  const reset = () => {
    setFile(null);
    setPlan(null);
    setError(null);
    setPhase('idle');
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (phase === 'checking' || phase === 'applying') return;
    void pick(e.dataTransfer.files?.[0]);
  };

  if (phase === 'done' && plan) return <Done plan={plan} fileName={file?.name ?? 'your file'} onAgain={reset} />;

  const busy = phase === 'checking' || phase === 'applying';
  const changed = plan ? plan.changes.filter((c) => c.action !== 'unchanged') : [];
  const visible = plan ? (showUnchanged ? plan.changes : changed) : [];
  const unchangedCount = plan ? plan.changes.length - changed.length : 0;

  return (
    <div className="space-y-4">
      <Panel title="2. Upload your file" description="We check every row and show you what would change. Nothing is saved yet." bodyClassName="p-4">
        <label
          onDragOver={(e) => {
            e.preventDefault();
            if (!dragging) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={clsx(
            'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[6px] border-2 border-dashed px-4 py-8 text-center has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-marigold',
            dragging ? 'border-padma bg-padma-tint' : 'border-line bg-paper hover:border-ink-faint',
            busy && 'pointer-events-none opacity-70',
          )}
        >
          {busy ? <Spinner className="size-8" /> : <Upload className="size-8 text-ink-faint" aria-hidden />}
          {busy ? (
            <span className="font-semibold text-ink">{phase === 'checking' ? 'Checking your file…' : 'Saving the changes…'}</span>
          ) : (
            <>
              <span className="font-semibold text-ink">Drop the .xlsx file here</span>
              <span className="text-sm text-ink-soft">
                or <span className="font-semibold text-padma underline">choose a file</span>. Up to 8 MB.
              </span>
            </>
          )}
          <input
            ref={input}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="sr-only"
            disabled={busy}
            onChange={(e) => pick(e.target.files?.[0])}
          />
        </label>
        {file && (
          <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <FileSpreadsheet className="size-4 shrink-0 text-padma" aria-hidden />
            <span className="min-w-0 font-medium break-all text-ink">{file.name}</span>
            <span className="text-ink-soft">{size(file.size)}</span>
          </p>
        )}
        {error && (
          <p className="mt-3 flex items-start gap-2 rounded-md border border-sindoor/30 bg-sindoor-tint px-3 py-2 text-sm text-sindoor" role="alert">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            {error}
          </p>
        )}
      </Panel>

      {plan && (
        <section className="space-y-4" aria-labelledby="preview-title">
          <div>
            <h2 id="preview-title" className="text-lg font-semibold text-ink">
              3. Check the changes
            </h2>
            <p className="text-sm text-ink-soft">{plural(plan.rows, 'row')} read from the file.</p>
          </div>
          <SummaryChips plan={plan} />

          {plan.errors.length > 0 && (
            <Panel
              className="border-sindoor/40"
              title={<span className="text-sindoor">{plural(plan.errors.length, 'problem')} to fix</span>}
              description="Fix these in the file and upload it again. Nothing has changed."
            >
              <TableWrap className="sm:max-h-96">
                <Table>
                  <thead>
                    <tr>
                      <Th align="right">Row</Th>
                      <Th>SKU</Th>
                      <Th>Problem</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {plan.errors.slice(0, SHOW_MAX).map((e, i) => (
                      <tr key={`${e.row}-${i}`} className="bg-sindoor-tint/40">
                        <Td num className="text-ink-soft">
                          {e.row}
                        </Td>
                        <Td className="font-mono text-xs whitespace-nowrap">{e.sku || <span className="font-sans text-ink-faint">None</span>}</Td>
                        <Td className="min-w-64 text-sindoor">{e.message}</Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </TableWrap>
            </Panel>
          )}

          <Panel
            title="Changes"
            description={changed.length ? `${plural(changed.length, 'row')} would change` : 'No row would change anything'}
            actions={
              unchangedCount > 0 && (
                <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-ink">
                  <input type="checkbox" className="size-4 accent-padma" checked={showUnchanged} onChange={(e) => setShowUnchanged(e.target.checked)} />
                  Show {plural(unchangedCount, 'unchanged row')}
                </label>
              )
            }
          >
            {visible.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-ink-soft">
                {plan.changes.length === 0 ? 'Rows that pass the checks will be listed here.' : 'Every row matches the catalog already. There is nothing to apply.'}
              </p>
            ) : (
              <TableWrap className="sm:max-h-[32rem]">
                <Table>
                  <thead>
                    <tr>
                      <Th align="right">Row</Th>
                      <Th>SKU</Th>
                      <Th>Product</Th>
                      <Th>Change</Th>
                      <Th>Details</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.slice(0, SHOW_MAX).map((c) => (
                      <tr key={`${c.row}-${c.sku}`} className={clsx(c.action === 'unchanged' && 'text-ink-soft')}>
                        <Td num className="text-ink-soft">
                          {c.row}
                        </Td>
                        <Td className="font-mono text-xs whitespace-nowrap">{c.sku}</Td>
                        <Td className="min-w-48">{c.product}</Td>
                        <Td>
                          <Badge tone={ACTION[c.action].tone}>{ACTION[c.action].label}</Badge>
                        </Td>
                        <Td className="min-w-56 text-ink-soft">{c.details.length ? c.details.join('; ') : c.action === 'create' ? 'Added as a new SKU' : ''}</Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </TableWrap>
            )}
            {visible.length > SHOW_MAX && <p className="px-4 py-2 text-xs text-ink-soft">Showing the first {SHOW_MAX.toLocaleString('en-IN')} of {visible.length.toLocaleString('en-IN')} rows.</p>}
          </Panel>

          <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center justify-between gap-3 border-t border-line bg-white px-4 py-3 sm:static sm:mx-0 sm:rounded-[6px] sm:border">
            <p className="text-sm text-ink-soft">
              {plan.errors.length
                ? 'Fix the problems above, then upload the file again.'
                : changed.length
                  ? `Applying saves ${plural(changed.length, 'row')} to the catalog. Stock changes go into the stock history.`
                  : 'Nothing to apply.'}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => input.current?.click()} disabled={busy}>
                {plan.errors.length ? 'Upload the fixed file' : 'Upload another file'}
              </Button>
              <Button onClick={apply} loading={phase === 'applying'} disabled={busy || plan.errors.length > 0 || changed.length === 0}>
                Apply changes
              </Button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function SummaryChips({ plan }: { plan: Plan }) {
  const s = plan.summary;
  const chips: [number, string][] = [
    [s.newProducts, s.newProducts === 1 ? 'new product' : 'new products'],
    [s.updatedProducts, s.updatedProducts === 1 ? 'product changed' : 'products changed'],
    [s.newVariants, s.newVariants === 1 ? 'new SKU' : 'new SKUs'],
    [s.updatedVariants, s.updatedVariants === 1 ? 'SKU changed' : 'SKUs changed'],
    [s.stockChanges, s.stockChanges === 1 ? 'stock change' : 'stock changes'],
    [s.unchanged, 'unchanged'],
  ];
  return (
    <ul className="flex flex-wrap gap-2" aria-label="Summary">
      {plan.errors.length > 0 && (
        <li className="inline-flex items-center gap-1.5 rounded-md border border-sindoor/40 bg-sindoor-tint px-2.5 py-1 text-sm text-sindoor">
          <span className="font-bold tabular-nums">{plan.errors.length}</span> {plan.errors.length === 1 ? 'problem' : 'problems'}
        </li>
      )}
      {chips.map(([n, label]) => (
        <li key={label} className={clsx('inline-flex items-center gap-1.5 rounded-md border border-line bg-white px-2.5 py-1 text-sm', n ? 'text-ink' : 'text-ink-faint')}>
          <span className="font-bold tabular-nums">{n.toLocaleString('en-IN')}</span> {label}
        </li>
      ))}
      {s.newBrands.length > 0 && (
        <li className="inline-flex items-center gap-1.5 rounded-md border border-marigold/40 bg-marigold-tint px-2.5 py-1 text-sm text-ink">
          New {s.newBrands.length === 1 ? 'brand' : 'brands'}: <span className="font-semibold">{s.newBrands.join(', ')}</span>
        </li>
      )}
    </ul>
  );
}

function Done({ plan, fileName, onAgain }: { plan: Plan; fileName: string; onAgain: () => void }) {
  const s = plan.summary;
  const parts = [
    s.newProducts && plural(s.newProducts, 'new product'),
    s.updatedProducts && plural(s.updatedProducts, 'product changed', 'products changed'),
    s.newVariants && plural(s.newVariants, 'new SKU'),
    s.updatedVariants && plural(s.updatedVariants, 'SKU changed', 'SKUs changed'),
    s.stockChanges && plural(s.stockChanges, 'stock change'),
  ].filter(Boolean);
  return (
    <Panel bodyClassName="flex flex-col items-center px-6 py-10 text-center">
      <CircleCheck className="size-10 text-padma" aria-hidden />
      <h2 className="mt-3 text-lg font-semibold text-ink">Catalog updated</h2>
      <p className="mt-1 max-w-md text-ink-soft">
        {fileName} is saved: {parts.length ? parts.join(', ') : 'no changes'}.
        {s.newBrands.length > 0 && ` New ${s.newBrands.length === 1 ? 'brand' : 'brands'}: ${s.newBrands.join(', ')}.`}
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <Link href="/admin/products" className="inline-flex h-10 items-center rounded-md bg-padma px-4 text-[15px] font-semibold text-white hover:bg-padma-dark">
          View products
        </Link>
        <Link href="/admin/inventory" className="inline-flex h-10 items-center rounded-md border border-line bg-white px-4 text-[15px] font-semibold text-ink hover:border-ink-faint">
          View inventory
        </Link>
        <Button variant="ghost" onClick={onAgain}>
          Import another file
        </Button>
      </div>
    </Panel>
  );
}
