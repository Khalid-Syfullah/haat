'use client';

import { CornerDownRight, Layers, Pencil, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { FormEvent, useMemo, useState } from 'react';
import { useToast } from '@/components/providers';
import { Badge, Button, EmptyState, Field, Input, Modal, Select } from '@/components/ui';
import { del, patch, post } from '@/lib/api';
import { DeleteButton, ImageField, Toggle } from './common';
import { CategoryOptions, CategoryRow, errorMessage, flattenCategories, Panel, PanelTitle, td, tdNum, th, thNum, Thumb } from './utils';

type Editing = { mode: 'new'; parentId?: string } | { mode: 'edit'; row: CategoryRow };

export function CategoryManager({ categories }: { categories: CategoryRow[] }) {
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState<Editing | null>(null);
  const rows = useMemo(() => flattenCategories(categories), [categories]);

  return (
    <Panel>
      <PanelTitle
        title="Category tree"
        description="Product counts are for products filed directly in each category."
        actions={
          <Button size="sm" onClick={() => setEditing({ mode: 'new' })}>
            <Plus className="size-4" aria-hidden />
            Add category
          </Button>
        }
      />
      {rows.length === 0 ? (
        <EmptyState icon={<Layers className="size-8" />} title="No categories yet" body="Add a top-level category such as Electronics, then add sub-categories under it." />
      ) : (
        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr>
                <th className={th}>Name</th>
                <th className={th}>Bangla name</th>
                <th className={th}>Slug</th>
                <th className={thNum}>Order</th>
                <th className={thNum}>Products</th>
                <th className={th}>Visibility</th>
                <th className={th}>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className={c.depth === 0 ? 'bg-paper/40' : undefined}>
                  <td className={td}>
                    <div className="flex items-center gap-2" style={{ paddingLeft: c.depth * 24 }}>
                      {c.depth > 0 && <CornerDownRight className="size-4 shrink-0 text-ink-faint" aria-hidden />}
                      <Thumb src={c.imageUrl} size={32} />
                      <span className={c.depth === 0 ? 'font-semibold text-ink' : 'font-medium text-ink'}>{c.name}</span>
                      {c.childCount > 0 && <span className="text-xs text-ink-faint">{c.childCount} sub</span>}
                    </div>
                  </td>
                  <td className={`${td} text-ink-soft`}>{c.nameBn ?? ''}</td>
                  <td className={`${td} font-mono text-xs text-ink-soft`}>{c.slug}</td>
                  <td className={`${tdNum} text-ink-soft`}>{c.sortOrder}</td>
                  <td className={tdNum}>{c.productCount}</td>
                  <td className={td}>{c.isActive ? <Badge tone="green">Visible</Badge> : <Badge>Hidden</Badge>}</td>
                  <td className={`${td} whitespace-nowrap text-right`}>
                    {c.depth === 0 && (
                      <Button variant="ghost" size="sm" onClick={() => setEditing({ mode: 'new', parentId: c.id })}>
                        <Plus className="size-4" aria-hidden />
                        Sub-category
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => setEditing({ mode: 'edit', row: c })}>
                      <Pencil className="size-4" aria-hidden />
                      Edit
                    </Button>
                    <DeleteButton
                      iconOnly
                      label={`Delete ${c.name}`}
                      title="Delete category"
                      body={
                        <>
                          Delete <span className="font-semibold text-ink">{c.name}</span>? Categories that still hold products or sub-categories cannot be deleted. Hide them instead.
                        </>
                      }
                      confirmLabel="Delete category"
                      onConfirm={async () => {
                        try {
                          await del(`/admin/categories/${c.id}`);
                          toast('Category deleted');
                          router.refresh();
                        } catch (e) {
                          toast(errorMessage(e), 'error');
                        }
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && (
        <CategoryForm
          key={editing.mode === 'edit' ? editing.row.id : `new-${editing.parentId ?? ''}`}
          editing={editing}
          categories={categories}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      )}
    </Panel>
  );
}

function CategoryForm({ editing, categories, onClose, onSaved }: { editing: Editing; categories: CategoryRow[]; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const row = editing.mode === 'edit' ? editing.row : null;
  const [f, setF] = useState({
    name: row?.name ?? '',
    nameBn: row?.nameBn ?? '',
    slug: row?.slug ?? '',
    parentId: row ? (row.parentId ?? '') : editing.mode === 'new' ? (editing.parentId ?? '') : '',
    icon: row?.icon ?? '',
    imageUrl: row?.imageUrl ?? '',
    sortOrder: String(row?.sortOrder ?? 0),
    isActive: row?.isActive ?? true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => {
    setF((p) => ({ ...p, [k]: v }));
    setErrors((e) => {
      if (!(k in e)) return e;
      const { [k as string]: _gone, ...rest } = e;
      return rest;
    });
  };

  // A category cannot move under itself or its own descendants.
  const exclude = useMemo(() => {
    const out = new Set<string>();
    if (!row) return out;
    const walk = (id: string) => {
      out.add(id);
      categories.filter((c) => c.parentId === id).forEach((c) => walk(c.id));
    };
    walk(row.id);
    return out;
  }, [row, categories]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (f.name.trim().length < 2) errs.name = 'Enter at least 2 characters';
    if (!Number.isInteger(Number(f.sortOrder)) || f.sortOrder.trim() === '') errs.sortOrder = 'Enter a whole number';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    const body = {
      name: f.name.trim(),
      nameBn: f.nameBn.trim() || null,
      slug: f.slug.trim() || undefined,
      parentId: f.parentId || null,
      icon: f.icon.trim() || null,
      imageUrl: f.imageUrl || null,
      sortOrder: Number(f.sortOrder),
      isActive: f.isActive,
    };
    setBusy(true);
    try {
      if (row) await patch(`/admin/categories/${row.id}`, body);
      else await post('/admin/categories', body);
      toast(row ? 'Category saved' : 'Category added');
      onSaved();
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={row ? `Edit ${row.name}` : 'Add category'} wide>
      <form onSubmit={submit} className="grid gap-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" error={errors.name}>
            <Input value={f.name} maxLength={60} onChange={(e) => set('name', e.target.value)} autoFocus />
          </Field>
          <Field label="Bangla name" hint="Shown alongside the English name, e.g. মোবাইল">
            <Input value={f.nameBn} maxLength={60} lang="bn" onChange={(e) => set('nameBn', e.target.value)} />
          </Field>
          <Field label="Slug" hint="Leave blank to create one from the name.">
            <Input value={f.slug} maxLength={80} onChange={(e) => set('slug', e.target.value)} />
          </Field>
          <Field label="Parent category">
            <Select value={f.parentId} onChange={(e) => set('parentId', e.target.value)}>
              <option value="">None (top level)</option>
              <CategoryOptions categories={categories} exclude={exclude} />
            </Select>
          </Field>
          <Field label="Icon name" hint="A Lucide icon name, e.g. smartphone, shirt, sofa">
            <Input value={f.icon} maxLength={40} onChange={(e) => set('icon', e.target.value)} />
          </Field>
          <Field label="Sort order" hint="Lower numbers come first." error={errors.sortOrder}>
            <Input type="number" inputMode="numeric" value={f.sortOrder} onChange={(e) => set('sortOrder', e.target.value)} />
          </Field>
        </div>
        <ImageField label="Image" value={f.imageUrl} onChange={(v) => set('imageUrl', v)} hint="Square image shown in category tiles." />
        <Toggle label="Visible in store" hint="Hidden categories and their products stay out of menus." checked={f.isActive} onChange={(v) => set('isActive', v)} />
        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={busy}>
            {row ? 'Save category' : 'Add category'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
