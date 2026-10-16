'use client';

import { ChevronLeft, ChevronRight, ExternalLink, ImagePlus, Plus, Trash2, Wand2, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useMemo, useRef, useState } from 'react';
import { useToast } from '@/components/providers';
import { Badge, Button, clsx, Field, Input, Select, Textarea } from '@/components/ui';
import { post, put, uploadImage } from '@/lib/api';
import { tk } from '@/lib/format';
import { Toggle } from './common';
import { ArchiveProductButton } from './product-actions';
import { CategoryOptions, CategoryRow, errorMessage, Panel, PanelTitle, th, Thumb } from './utils';

export interface AdminVariant {
  id: string;
  sku: string;
  options: Record<string, string> | null;
  price: number;
  salePrice: number | null;
  stock: number;
  lowStockThreshold: number;
  imageUrl: string | null;
  isActive: boolean;
}

export interface AdminProduct {
  id: string;
  title: string;
  slug: string;
  description: string;
  highlights: string[];
  brandId: string | null;
  categoryId: string;
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  optionNames: string[];
  specs: { name: string; value: string }[] | null;
  keywords: string;
  warranty: string | null;
  returnDays: number;
  weightGrams: number;
  isFeatured: boolean;
  images: { id: string; url: string; alt: string | null }[];
  variants: AdminVariant[];
}

export interface BrandOption {
  id: string;
  name: string;
}

interface VariantRow {
  key: string;
  id?: string;
  values: string[];
  sku: string;
  price: string;
  salePrice: string;
  stock: string;
  lowStockThreshold: string;
  imageUrl: string;
  isActive: boolean;
}

interface OptionRow {
  key: string;
  name: string;
  values: string;
}

interface FormState {
  title: string;
  slug: string;
  status: AdminProduct['status'];
  isFeatured: boolean;
  categoryId: string;
  brandId: string;
  description: string;
  highlights: string[];
  specs: { key: string; name: string; value: string }[];
  keywords: string;
  warranty: string;
  returnDays: string;
  weightGrams: string;
  images: string[];
  options: OptionRow[];
  variants: VariantRow[];
}

let seq = 0;
const uid = () => `k${++seq}`;
const MAX_IMAGES = 12;
const MAX_OPTIONS = 3;

function blankVariant(optionCount: number, patch: Partial<VariantRow> = {}): VariantRow {
  return {
    key: uid(),
    values: Array(optionCount).fill(''),
    sku: '',
    price: '',
    salePrice: '',
    stock: '0',
    lowStockThreshold: '5',
    imageUrl: '',
    isActive: true,
    ...patch,
  };
}

function fromProduct(p?: AdminProduct): FormState {
  if (!p) {
    return {
      title: '',
      slug: '',
      status: 'ACTIVE',
      isFeatured: false,
      categoryId: '',
      brandId: '',
      description: '',
      highlights: [],
      specs: [],
      keywords: '',
      warranty: '',
      returnDays: '7',
      weightGrams: '500',
      images: [],
      options: [],
      variants: [blankVariant(0)],
    };
  }
  const names = p.optionNames ?? [];
  const valuesFor = (i: number) => {
    const seen: string[] = [];
    for (const v of p.variants) {
      const val = v.options?.[names[i]];
      if (val && !seen.includes(val)) seen.push(val);
    }
    return seen.join(', ');
  };
  return {
    title: p.title,
    slug: p.slug,
    status: p.status,
    isFeatured: p.isFeatured,
    categoryId: p.categoryId,
    brandId: p.brandId ?? '',
    description: p.description ?? '',
    highlights: p.highlights ?? [],
    specs: (Array.isArray(p.specs) ? p.specs : []).map((s) => ({ key: uid(), name: s.name, value: s.value })),
    keywords: p.keywords ?? '',
    warranty: p.warranty ?? '',
    returnDays: String(p.returnDays),
    weightGrams: String(p.weightGrams),
    images: p.images.map((i) => i.url),
    options: names.map((name, i) => ({ key: uid(), name, values: valuesFor(i) })),
    variants: p.variants.map((v) => ({
      key: uid(),
      id: v.id,
      values: names.map((n) => v.options?.[n] ?? ''),
      sku: v.sku,
      price: String(v.price),
      salePrice: v.salePrice != null ? String(v.salePrice) : '',
      stock: String(v.stock),
      lowStockThreshold: String(v.lowStockThreshold),
      imageUrl: v.imageUrl ?? '',
      isActive: v.isActive,
    })),
  };
}

const splitValues = (raw: string) => {
  const out: string[] = [];
  for (const part of raw.split(',')) {
    const v = part.trim();
    if (v && !out.some((o) => o.toLowerCase() === v.toLowerCase())) out.push(v);
  }
  return out;
};

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

function cartesian(lists: string[][]): string[][] {
  return lists.reduce<string[][]>((acc, list) => acc.flatMap((combo) => list.map((v) => [...combo, v])), [[]]);
}

const skuPart = (s: string, len = 3) =>
  s
    .normalize('NFKD')
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase()
    .slice(0, len);

const num = (s: string) => (s.trim() === '' ? NaN : Number(s));
const wholeAtLeast = (s: string, min: number) => {
  const n = num(s);
  return Number.isInteger(n) && n >= min;
};

type Errors = Record<string, string>;

function validate(f: FormState): Errors {
  const e: Errors = {};
  if (f.title.trim().length < 3) e.title = 'Enter a title of at least 3 characters';
  if (!f.categoryId) e.categoryId = 'Pick a category';
  if (!wholeAtLeast(f.returnDays, 0) || num(f.returnDays) > 60) e.returnDays = 'Enter 0 to 60 days';
  if (!wholeAtLeast(f.weightGrams, 0)) e.weightGrams = 'Enter the weight in whole grams';
  if (f.highlights.filter((h) => h.trim()).length > 10) e.highlights = 'Keep it to 10 highlights';
  f.specs.forEach((s) => {
    if (s.name.trim() && !s.value.trim()) e[`spec:${s.key}`] = 'Add a value or remove this row';
    if (!s.name.trim() && s.value.trim()) e[`spec:${s.key}`] = 'Add a name or remove this row';
  });

  const names = f.options.map((o) => o.name.trim());
  f.options.forEach((o, i) => {
    if (!names[i]) e[`opt:${o.key}`] = 'Name this option, for example Color';
    else if (names.findIndex((n) => same(n, names[i])) !== i) e[`opt:${o.key}`] = 'Each option needs a different name';
  });

  if (!f.variants.length) e.variants = 'Add at least one variant';
  else if (!f.options.length && f.variants.length > 1) e.variants = 'Add an option such as Color or Size to sell more than one variant';

  const skus = new Map<string, number>();
  const combos = new Map<string, number>();
  f.variants.forEach((v) => {
    const sku = v.sku.trim().toUpperCase();
    if (sku) skus.set(sku, (skus.get(sku) ?? 0) + 1);
    if (f.options.length) {
      const c = v.values.map((x) => x.trim().toLowerCase()).join('|');
      combos.set(c, (combos.get(c) ?? 0) + 1);
    }
  });
  f.variants.forEach((v, i) => {
    const row = `Row ${i + 1}`;
    const msgs: string[] = [];
    if (f.options.length && v.values.some((x, j) => j < f.options.length && !x.trim())) msgs.push('fill in every option value');
    else if (f.options.length && (combos.get(v.values.map((x) => x.trim().toLowerCase()).join('|')) ?? 0) > 1) msgs.push('another row has the same option values');
    const sku = v.sku.trim();
    if (!sku) msgs.push('SKU is required');
    else if (sku.length < 2 || sku.length > 60) msgs.push('SKU must be 2 to 60 characters');
    else if ((skus.get(sku.toUpperCase()) ?? 0) > 1) msgs.push('SKU is used on another row');
    if (!wholeAtLeast(v.price, 1)) msgs.push('enter a price in whole taka');
    if (v.salePrice.trim()) {
      if (!wholeAtLeast(v.salePrice, 1)) msgs.push('enter the sale price in whole taka');
      else if (wholeAtLeast(v.price, 1) && num(v.salePrice) >= num(v.price)) msgs.push('sale price must be below the price');
    }
    if (!wholeAtLeast(v.stock, 0)) msgs.push('stock must be 0 or more');
    if (!wholeAtLeast(v.lowStockThreshold, 0)) msgs.push('low-stock alert must be 0 or more');
    if (msgs.length) e[`v:${v.key}`] = `${row}: ${msgs.join(', ')}`;
  });
  return e;
}

export function ProductEditor({ product, categories, brands }: { product?: AdminProduct; categories: CategoryRow[]; brands: BrandOption[] }) {
  const router = useRouter();
  const toast = useToast();
  const [f, setF] = useState<FormState>(() => fromProduct(product));
  const [saved, setSaved] = useState<AdminProduct | undefined>(product);
  const [errors, setErrors] = useState<Errors>({});
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [highlightDraft, setHighlightDraft] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const skuCode = useMemo(() => {
    const first = product?.variants[0]?.sku;
    if (first) {
      const parts = first.split('-');
      const keep = Math.max(1, parts.length - (product?.optionNames.length ?? 0));
      return parts.slice(0, keep).join('-');
    }
    return '';
  }, [product]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setF((prev) => {
      const next = { ...prev, [key]: value };
      if (tried) setErrors(validate(next));
      return next;
    });

  const update = (fn: (prev: FormState) => FormState) =>
    setF((prev) => {
      const next = fn(prev);
      if (tried) setErrors(validate(next));
      return next;
    });

  const setVariant = (key: string, patch: Partial<VariantRow>) =>
    update((p) => ({ ...p, variants: p.variants.map((v) => (v.key === key ? { ...v, ...patch } : v)) }));

  const [skuSuffix] = useState(() => (Date.now() % 46656).toString(36).toUpperCase().padStart(3, '0'));
  const skuBase = () => {
    if (skuCode) return skuCode;
    const word = skuPart(f.title.split(/\s+/)[0] ?? '', 4) || 'SKU';
    return `${word}-${skuSuffix}`;
  };

  // ───── Images ─────

  async function addImages(files: FileList | null) {
    if (!files?.length) return;
    const room = MAX_IMAGES - f.images.length;
    const list = Array.from(files).slice(0, room);
    if (files.length > room) toast(`Products take up to ${MAX_IMAGES} images`, 'error');
    setUploading(true);
    const urls: string[] = [];
    for (const file of list) {
      try {
        urls.push(await uploadImage(file));
      } catch (e) {
        toast(errorMessage(e), 'error');
      }
    }
    setUploading(false);
    if (fileInput.current) fileInput.current.value = '';
    if (urls.length) update((p) => ({ ...p, images: [...p.images, ...urls] }));
  }

  const moveImage = (i: number, dir: -1 | 1) =>
    update((p) => {
      const imgs = [...p.images];
      const j = i + dir;
      if (j < 0 || j >= imgs.length) return p;
      [imgs[i], imgs[j]] = [imgs[j], imgs[i]];
      return { ...p, images: imgs };
    });

  const removeImage = (i: number) =>
    update((p) => {
      const url = p.images[i];
      return { ...p, images: p.images.filter((_, k) => k !== i), variants: p.variants.map((v) => (v.imageUrl === url ? { ...v, imageUrl: '' } : v)) };
    });

  // ───── Options and variants ─────

  const addOption = () =>
    update((p) => ({
      ...p,
      options: [...p.options, { key: uid(), name: p.options.length === 0 ? 'Color' : p.options.length === 1 ? 'Size' : '', values: '' }],
      variants: p.variants.map((v) => ({ ...v, values: [...v.values, ''] })),
    }));

  const removeOption = (i: number) =>
    update((p) => ({
      ...p,
      options: p.options.filter((_, k) => k !== i),
      variants: p.variants.map((v) => ({ ...v, values: v.values.filter((_, k) => k !== i) })),
    }));

  function generate() {
    const lists = f.options.map((o) => splitValues(o.values));
    if (!f.options.length) {
      toast('Add an option such as Color first', 'error');
      return;
    }
    const emptyAt = lists.findIndex((l) => l.length === 0);
    if (emptyAt >= 0) {
      toast(`Enter values for ${f.options[emptyAt].name.trim() || `option ${emptyAt + 1}`}, separated by commas`, 'error');
      return;
    }
    const combos = cartesian(lists);
    if (combos.length > 100) {
      toast(`That makes ${combos.length} variants. Products take up to 100.`, 'error');
      return;
    }
    const pool = [...f.variants];
    const template = f.variants.find((v) => v.price.trim());
    const base = skuBase();
    const used = new Set<string>();
    const makeSku = (combo: string[]) => {
      const stem = [base, ...combo.map((c) => skuPart(c) || 'X')].join('-');
      let sku = stem;
      for (let n = 2; used.has(sku) || f.variants.some((v) => v.sku.trim().toUpperCase() === sku); n++) sku = `${stem}-${n}`;
      used.add(sku);
      return sku;
    };
    for (const v of f.variants) if (v.sku.trim()) used.add(v.sku.trim().toUpperCase());
    const rows: VariantRow[] = combos.map((combo) => {
      // Exact match first, then a row whose blank values fit this combination (e.g. a newly added option).
      let idx = pool.findIndex((v) => combo.every((c, j) => same(v.values[j] ?? '', c)));
      if (idx < 0) idx = pool.findIndex((v) => combo.every((c, j) => !(v.values[j] ?? '').trim() || same(v.values[j], c)));
      if (idx >= 0) {
        const [row] = pool.splice(idx, 1);
        return { ...row, values: combo, sku: row.sku.trim() ? row.sku : makeSku(combo) };
      }
      const sku = makeSku(combo);
      return blankVariant(f.options.length, {
        values: combo,
        sku,
        price: template?.price ?? '',
        salePrice: template?.salePrice ?? '',
        lowStockThreshold: template?.lowStockThreshold ?? '5',
      });
    });
    const dropped = pool.length;
    update((p) => ({ ...p, variants: rows }));
    toast(dropped ? `${rows.length} variants ready. ${dropped} row${dropped === 1 ? '' : 's'} that no longer match were removed.` : `${rows.length} variants ready`);
  }

  // ───── Save ─────

  async function save(e?: FormEvent) {
    e?.preventDefault();
    setTried(true);
    const errs = validate(f);
    setErrors(errs);
    if (Object.keys(errs).length) {
      toast(Object.values(errs)[0], 'error');
      return;
    }
    const names = f.options.map((o) => o.name.trim());
    const body = {
      title: f.title.trim(),
      slug: f.slug.trim() || undefined,
      status: f.status,
      isFeatured: f.isFeatured,
      categoryId: f.categoryId,
      brandId: f.brandId || null,
      description: f.description,
      highlights: f.highlights.map((h) => h.trim()).filter(Boolean),
      specs: f.specs.filter((s) => s.name.trim() && s.value.trim()).map((s) => ({ name: s.name.trim(), value: s.value.trim() })),
      keywords: f.keywords.trim(),
      warranty: f.warranty.trim() || null,
      returnDays: num(f.returnDays),
      weightGrams: num(f.weightGrams),
      optionNames: names,
      images: f.images.map((url) => ({ url, alt: f.title.trim() })),
      variants: f.variants.map((v) => ({
        ...(v.id ? { id: v.id } : {}),
        sku: v.sku.trim().toUpperCase(),
        options: Object.fromEntries(names.map((n, i) => [n, v.values[i]?.trim() ?? ''])),
        price: num(v.price),
        salePrice: v.salePrice.trim() ? num(v.salePrice) : null,
        stock: num(v.stock),
        lowStockThreshold: num(v.lowStockThreshold),
        imageUrl: v.imageUrl || null,
        isActive: v.isActive,
      })),
    };
    setSaving(true);
    try {
      if (saved) {
        const res = await put<AdminProduct>(`/admin/products/${saved.id}`, body);
        setSaved(res);
        setF(fromProduct(res));
        setTried(false);
        toast('Product saved');
        router.refresh();
      } else {
        const res = await post<AdminProduct>('/admin/products', body);
        toast('Product created');
        router.push(`/admin/products/${res.id}`);
      }
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setSaving(false);
    }
  }

  const variantErrors = f.variants.map((v) => errors[`v:${v.key}`]).filter(Boolean);
  const errorCount = Object.keys(errors).length;
  const totalStock = f.variants.reduce((s, v) => s + (wholeAtLeast(v.stock, 0) ? num(v.stock) : 0), 0);

  return (
    <form onSubmit={save} noValidate>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <Link href="/admin/products" className="inline-flex items-center gap-1 text-sm text-ink-soft hover:text-ink">
            <ChevronLeft className="size-4" aria-hidden />
            Products
          </Link>
          <h1 className="text-2xl font-bold text-ink">{saved ? saved.title : 'New product'}</h1>
          {saved && (
            <p className="mt-0.5 text-ink-soft">
              {saved.variants.filter((v) => v.isActive).length} active variants, {totalStock} in stock
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {saved && (
            <a
              href={`/product/${saved.slug}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 items-center gap-2 rounded-md border border-line bg-white px-4 text-[15px] font-semibold text-ink hover:border-ink-faint"
            >
              <ExternalLink className="size-4" aria-hidden />
              View in store
            </a>
          )}
          {saved && saved.status !== 'ARCHIVED' && (
            <ArchiveProductButton
              size="md"
              id={saved.id}
              title={saved.title}
              onDone={() => {
                setSaved({ ...saved, status: 'ARCHIVED' });
                setF((p) => ({ ...p, status: 'ARCHIVED' }));
                router.refresh();
              }}
            />
          )}
          <Button type="submit" loading={saving}>
            {saved ? 'Save product' : 'Create product'}
          </Button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-5">
          <Panel>
            <PanelTitle title="Basic details" />
            <div className="grid gap-4 p-4">
              <Field label="Title" error={errors.title}>
                <Input value={f.title} onChange={(e) => set('title', e.target.value)} maxLength={200} placeholder="e.g. Sonora Buds Pro TWS Earbuds" />
              </Field>
              <Field label="Slug (optional)" hint="Used in the product link. Leave blank to create one from the title.">
                <Input value={f.slug} onChange={(e) => set('slug', e.target.value)} maxLength={100} placeholder="sonora-buds-pro" />
              </Field>
              <Field label="Description">
                <Textarea value={f.description} onChange={(e) => set('description', e.target.value)} rows={7} maxLength={20000} />
              </Field>
              <div>
                <span className="mb-1 block text-sm font-medium text-ink">Highlights</span>
                {f.highlights.length > 0 && (
                  <ul className="mb-2 flex flex-col gap-1.5">
                    {f.highlights.map((h, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <Input
                          value={h}
                          aria-label={`Highlight ${i + 1}`}
                          onChange={(e) => set('highlights', f.highlights.map((x, k) => (k === i ? e.target.value : x)))}
                        />
                        <Button type="button" variant="ghost" size="sm" aria-label={`Remove highlight ${i + 1}`} onClick={() => set('highlights', f.highlights.filter((_, k) => k !== i))}>
                          <X className="size-4" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="flex gap-2">
                  <Input
                    value={highlightDraft}
                    aria-label="New highlight"
                    placeholder="e.g. 30 hours battery with case"
                    onChange={(e) => setHighlightDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (highlightDraft.trim() && f.highlights.length < 10) {
                          set('highlights', [...f.highlights, highlightDraft.trim()]);
                          setHighlightDraft('');
                        }
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!highlightDraft.trim() || f.highlights.length >= 10}
                    onClick={() => {
                      set('highlights', [...f.highlights, highlightDraft.trim()]);
                      setHighlightDraft('');
                    }}
                  >
                    Add highlight
                  </Button>
                </div>
                <span className={clsx('mt-1 block text-xs', errors.highlights ? 'text-sindoor' : 'text-ink-soft')}>
                  {errors.highlights ?? 'Short selling points shown near the price. Up to 10.'}
                </span>
              </div>
            </div>
          </Panel>

          <Panel>
            <PanelTitle
              title="Images"
              description="The first image is the main image. JPG, PNG, WEBP or GIF under 3 MB."
              actions={
                <Button type="button" variant="outline" size="sm" loading={uploading} disabled={f.images.length >= MAX_IMAGES} onClick={() => fileInput.current?.click()}>
                  <ImagePlus className="size-4" aria-hidden />
                  Upload images
                </Button>
              }
            />
            <input
              ref={fileInput}
              type="file"
              multiple
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="sr-only"
              aria-label="Product image files"
              onChange={(e) => addImages(e.target.files)}
            />
            <div className="p-4">
              {f.images.length === 0 ? (
                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  className="flex w-full flex-col items-center gap-1 rounded-[6px] border border-dashed border-line bg-paper px-4 py-8 text-ink-soft hover:border-padma hover:text-padma"
                >
                  <ImagePlus className="size-6" aria-hidden />
                  <span className="text-sm font-medium">Upload product images</span>
                </button>
              ) : (
                <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-6">
                  {f.images.map((url, i) => (
                    <li key={url + i} className="overflow-hidden rounded-[6px] border border-line">
                      <div className="relative aspect-square bg-paper">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt={`Image ${i + 1}`} className="size-full object-cover" />
                        {i === 0 && <Badge tone="green" className="absolute left-1.5 top-1.5">Main</Badge>}
                      </div>
                      <div className="flex items-center justify-between border-t border-line px-1 py-1">
                        <button type="button" className="rounded p-1 text-ink-soft hover:bg-black/5 disabled:opacity-30" disabled={i === 0} onClick={() => moveImage(i, -1)} aria-label={`Move image ${i + 1} left`}>
                          <ChevronLeft className="size-4" />
                        </button>
                        <button type="button" className="rounded p-1 text-sindoor hover:bg-sindoor-tint" onClick={() => removeImage(i)} aria-label={`Remove image ${i + 1}`}>
                          <Trash2 className="size-4" />
                        </button>
                        <button
                          type="button"
                          className="rounded p-1 text-ink-soft hover:bg-black/5 disabled:opacity-30"
                          disabled={i === f.images.length - 1}
                          onClick={() => moveImage(i, 1)}
                          aria-label={`Move image ${i + 1} right`}
                        >
                          <ChevronRight className="size-4" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Panel>

          <Panel>
            <PanelTitle
              title="Specifications"
              description="Shown as a table on the product page."
              actions={
                <Button type="button" variant="outline" size="sm" onClick={() => set('specs', [...f.specs, { key: uid(), name: '', value: '' }])}>
                  <Plus className="size-4" aria-hidden />
                  Add spec
                </Button>
              }
            />
            <div className="p-4">
              {f.specs.length === 0 ? (
                <p className="text-sm text-ink-soft">No specs yet. Add rows such as RAM 8 GB or Material Cotton.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {f.specs.map((s, i) => (
                    <li key={s.key}>
                      <div className="flex gap-2">
                        <Input
                          className="max-w-[40%]"
                          value={s.name}
                          maxLength={60}
                          placeholder="Name"
                          aria-label={`Spec ${i + 1} name`}
                          onChange={(e) => set('specs', f.specs.map((x) => (x.key === s.key ? { ...x, name: e.target.value } : x)))}
                        />
                        <Input
                          value={s.value}
                          maxLength={200}
                          placeholder="Value"
                          aria-label={`Spec ${i + 1} value`}
                          onChange={(e) => set('specs', f.specs.map((x) => (x.key === s.key ? { ...x, value: e.target.value } : x)))}
                        />
                        <Button type="button" variant="ghost" size="sm" className="h-10" aria-label={`Remove spec ${i + 1}`} onClick={() => set('specs', f.specs.filter((x) => x.key !== s.key))}>
                          <X className="size-4" />
                        </Button>
                      </div>
                      {errors[`spec:${s.key}`] && <p className="mt-1 text-sm text-sindoor">{errors[`spec:${s.key}`]}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Panel>
        </div>

        <div className="flex flex-col gap-5">
          <Panel>
            <PanelTitle title="Visibility" />
            <div className="grid gap-4 p-4">
              <Field label="Status" hint={f.status === 'DRAFT' ? 'Drafts are hidden from the store.' : f.status === 'ARCHIVED' ? 'Archived products are hidden and cannot be ordered.' : 'Shown in the store.'}>
                <Select value={f.status} onChange={(e) => set('status', e.target.value as FormState['status'])}>
                  <option value="ACTIVE">Active</option>
                  <option value="DRAFT">Draft</option>
                  <option value="ARCHIVED">Archived</option>
                </Select>
              </Field>
              <Toggle label="Featured" hint="Picked for home page sections." checked={f.isFeatured} onChange={(v) => set('isFeatured', v)} />
            </div>
          </Panel>
          <Panel>
            <PanelTitle title="Organisation" />
            <div className="grid gap-4 p-4">
              <Field label="Category" error={errors.categoryId}>
                <Select value={f.categoryId} onChange={(e) => set('categoryId', e.target.value)}>
                  <option value="">Choose a category</option>
                  <CategoryOptions categories={categories} />
                </Select>
              </Field>
              <Field label="Brand">
                <Select value={f.brandId} onChange={(e) => set('brandId', e.target.value)}>
                  <option value="">No brand</option>
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Search keywords" hint="Add Bangla and Banglish names, e.g. মোবাইল, mobail">
                <Textarea value={f.keywords} onChange={(e) => set('keywords', e.target.value)} rows={3} maxLength={1000} className="min-h-0" />
              </Field>
            </div>
          </Panel>
          <Panel>
            <PanelTitle title="Warranty and delivery" />
            <div className="grid gap-4 p-4">
              <Field label="Warranty" hint="e.g. 1 year brand warranty. Leave blank for none.">
                <Input value={f.warranty} onChange={(e) => set('warranty', e.target.value)} maxLength={100} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Return days" hint="0 means not returnable" error={errors.returnDays}>
                  <Input type="number" inputMode="numeric" min={0} max={60} value={f.returnDays} onChange={(e) => set('returnDays', e.target.value)} />
                </Field>
                <Field label="Weight (grams)" error={errors.weightGrams}>
                  <Input type="number" inputMode="numeric" min={0} value={f.weightGrams} onChange={(e) => set('weightGrams', e.target.value)} />
                </Field>
              </div>
            </div>
          </Panel>
        </div>
      </div>

      <Panel className="mt-5">
        <PanelTitle
          title="Options and variants"
          description="Each variant is one SKU with its own price and stock. Up to 3 options, for example Color and Size."
        />
        <div className="border-b border-line p-4">
          {f.options.length === 0 ? (
            <p className="mb-3 text-sm text-ink-soft">This product has a single variant. Add an option if it comes in several colors, sizes or capacities.</p>
          ) : (
            <ul className="mb-3 flex flex-col gap-3">
              {f.options.map((o, i) => {
                const vals = splitValues(o.values);
                return (
                  <li key={o.key} className="grid gap-2 sm:grid-cols-[180px_minmax(0,1fr)_auto] sm:items-start">
                    <Field label={`Option ${i + 1} name`} error={errors[`opt:${o.key}`]}>
                      <Input
                        value={o.name}
                        placeholder="Color"
                        maxLength={30}
                        onChange={(e) => update((p) => ({ ...p, options: p.options.map((x) => (x.key === o.key ? { ...x, name: e.target.value } : x)) }))}
                      />
                    </Field>
                    <Field label="Values" hint={vals.length ? `${vals.length} value${vals.length === 1 ? '' : 's'}: ${vals.join(', ')}` : 'Separate values with commas, e.g. Black, White'}>
                      <Input
                        value={o.values}
                        placeholder="Black, White"
                        onChange={(e) => update((p) => ({ ...p, options: p.options.map((x) => (x.key === o.key ? { ...x, values: e.target.value } : x)) }))}
                      />
                    </Field>
                    <Button type="button" variant="ghost" size="sm" className="sm:mt-6" onClick={() => removeOption(i)}>
                      <X className="size-4" aria-hidden />
                      Remove option
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={addOption} disabled={f.options.length >= MAX_OPTIONS}>
              <Plus className="size-4" aria-hidden />
              Add option
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={generate} disabled={!f.options.length}>
              <Wand2 className="size-4" aria-hidden />
              Generate variants
            </Button>
          </div>
          {f.options.length > 0 && (
            <p className="mt-2 text-xs text-ink-soft">Generating keeps rows whose values still match and adds the missing combinations.</p>
          )}
        </div>

        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[960px] text-sm">
            <thead>
              <tr>
                {f.options.map((o, i) => (
                  <th key={o.key} className={th}>
                    {o.name.trim() || `Option ${i + 1}`}
                  </th>
                ))}
                <th className={th}>SKU</th>
                <th className={clsx(th, 'text-right')}>Price</th>
                <th className={clsx(th, 'text-right')}>Sale price</th>
                <th className={clsx(th, 'text-right')}>Stock</th>
                <th className={clsx(th, 'text-right')}>Low-stock alert</th>
                <th className={th}>Image</th>
                <th className={th}>Active</th>
                <th className={th}>
                  <span className="sr-only">Remove</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {f.variants.map((v, r) => {
                const bad = Boolean(errors[`v:${v.key}`]);
                const off = num(v.price) > 0 && num(v.salePrice) > 0 && num(v.salePrice) < num(v.price) ? Math.round((1 - num(v.salePrice) / num(v.price)) * 100) : 0;
                const imageMissing = v.imageUrl && !f.images.includes(v.imageUrl);
                return (
                  <tr key={v.key} className={clsx(bad && 'bg-sindoor-tint/40', !v.isActive && 'opacity-60')}>
                    {f.options.map((o, i) => (
                      <td key={o.key} className="border-b border-line px-2 py-2">
                        <Input
                          className="h-9 min-w-24 max-w-24"
                          value={v.values[i] ?? ''}
                          aria-label={`${o.name || `Option ${i + 1}`}, row ${r + 1}`}
                          onChange={(e) => setVariant(v.key, { values: v.values.map((x, k) => (k === i ? e.target.value : x)) })}
                        />
                      </td>
                    ))}
                    <td className="border-b border-line px-2 py-2">
                      <Input className="h-9 min-w-36 max-w-36 font-mono text-sm uppercase" value={v.sku} maxLength={60} aria-label={`SKU, row ${r + 1}`} onChange={(e) => setVariant(v.key, { sku: e.target.value })} />
                    </td>
                    <td className="border-b border-line px-2 py-2">
                      <Input className="h-9 min-w-24 max-w-24 text-right tabular-nums" type="number" inputMode="numeric" min={1} value={v.price} aria-label={`Price in taka, row ${r + 1}`} onChange={(e) => setVariant(v.key, { price: e.target.value })} />
                    </td>
                    <td className="border-b border-line px-2 py-2">
                      <Input
                        className="h-9 min-w-24 max-w-24 text-right tabular-nums"
                        type="number"
                        inputMode="numeric"
                        min={1}
                        value={v.salePrice}
                        placeholder="None"
                        aria-label={`Sale price in taka, row ${r + 1}`}
                        onChange={(e) => setVariant(v.key, { salePrice: e.target.value })}
                      />
                      {off > 0 && <span className="mt-0.5 block text-right text-xs text-sindoor">{off}% off</span>}
                    </td>
                    <td className="border-b border-line px-2 py-2">
                      <Input className="h-9 min-w-20 max-w-20 text-right tabular-nums" type="number" inputMode="numeric" min={0} value={v.stock} aria-label={`Stock, row ${r + 1}`} onChange={(e) => setVariant(v.key, { stock: e.target.value })} />
                    </td>
                    <td className="border-b border-line px-2 py-2">
                      <Input
                        className="h-9 min-w-20 max-w-20 text-right tabular-nums"
                        type="number"
                        inputMode="numeric"
                        min={0}
                        value={v.lowStockThreshold}
                        aria-label={`Low-stock alert level, row ${r + 1}`}
                        onChange={(e) => setVariant(v.key, { lowStockThreshold: e.target.value })}
                      />
                    </td>
                    <td className="border-b border-line px-2 py-2">
                      <div className="flex items-center gap-2">
                        <Thumb src={v.imageUrl || null} size={36} />
                        <Select className="h-9 min-w-28 max-w-28 text-sm" value={v.imageUrl} aria-label={`Image, row ${r + 1}`} onChange={(e) => setVariant(v.key, { imageUrl: e.target.value })}>
                          <option value="">Main image</option>
                          {imageMissing && <option value={v.imageUrl}>Current image</option>}
                          {f.images.map((url, i) => (
                            <option key={url + i} value={url}>
                              Image {i + 1}
                            </option>
                          ))}
                        </Select>
                      </div>
                    </td>
                    <td className="border-b border-line px-3 py-2">
                      <input type="checkbox" className="size-4 accent-padma" checked={v.isActive} aria-label={`Active, row ${r + 1}`} onChange={(e) => setVariant(v.key, { isActive: e.target.checked })} />
                    </td>
                    <td className="border-b border-line px-2 py-2 text-right">
                      <Button type="button" variant="ghost" size="sm" aria-label={`Remove row ${r + 1}`} onClick={() => update((p) => ({ ...p, variants: p.variants.filter((x) => x.key !== v.key) }))}>
                        <Trash2 className="size-4" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-start justify-between gap-3 p-4">
          <div className="min-w-0 flex-1 text-sm">
            {errors.variants && <p className="text-sindoor">{errors.variants}</p>}
            {variantErrors.length > 0 && (
              <ul className="flex flex-col gap-0.5 text-sindoor">
                {variantErrors.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            )}
            {!errors.variants && !variantErrors.length && (
              <p className="text-ink-soft">
                {f.variants.length} variant{f.variants.length === 1 ? '' : 's'}
                {f.variants.some((v) => num(v.price) > 0) && `, priced from ${tk(Math.min(...f.variants.filter((v) => num(v.price) > 0).map((v) => (num(v.salePrice) > 0 ? num(v.salePrice) : num(v.price)))))}`}
                . Changing stock here records an adjustment; use Inventory for restocks with a reason.
              </p>
            )}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={f.variants.length >= 100}
            onClick={() => {
              const t = f.variants[f.variants.length - 1];
              update((p) => ({ ...p, variants: [...p.variants, blankVariant(p.options.length, { price: t?.price ?? '', lowStockThreshold: t?.lowStockThreshold ?? '5' })] }));
            }}
          >
            <Plus className="size-4" aria-hidden />
            Add variant
          </Button>
        </div>
      </Panel>

      <div className="sticky bottom-0 z-10 -mx-4 mt-5 flex flex-wrap items-center justify-end gap-3 border-t border-line bg-white/95 px-4 py-3 sm:mx-0 sm:rounded-[6px] sm:border">
        {tried && errorCount > 0 && (
          <p className="mr-auto text-sm text-sindoor">
            Fix {errorCount} problem{errorCount === 1 ? '' : 's'} before saving
          </p>
        )}
        <Link href="/admin/products" className="inline-flex h-10 items-center rounded-md px-4 text-[15px] font-semibold text-ink-soft hover:bg-black/5 hover:text-ink">
          Cancel
        </Link>
        <Button type="submit" loading={saving}>
          {saved ? 'Save product' : 'Create product'}
        </Button>
      </div>
    </form>
  );
}
