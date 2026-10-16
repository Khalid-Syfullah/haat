'use client';

import { Pencil, Plus, Tags } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { useToast } from '@/components/providers';
import { Button, EmptyState, Field, Input, Modal } from '@/components/ui';
import { del, patch, post } from '@/lib/api';
import { DeleteButton, ImageField } from './common';
import { errorMessage, Panel, PanelTitle, td, tdNum, th, thNum } from './utils';

export interface BrandRow {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  productCount: number;
}

export function BrandManager({ brands }: { brands: BrandRow[] }) {
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState<BrandRow | 'new' | null>(null);

  return (
    <Panel>
      <PanelTitle
        title="All brands"
        actions={
          <Button size="sm" onClick={() => setEditing('new')}>
            <Plus className="size-4" aria-hidden />
            Add brand
          </Button>
        }
      />
      {brands.length === 0 ? (
        <EmptyState icon={<Tags className="size-8" />} title="No brands yet" body="Add the brands you sell so shoppers can filter by them." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr>
                <th className={th}>Brand</th>
                <th className={th}>Slug</th>
                <th className={thNum}>Products</th>
                <th className={th}>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {brands.map((b) => (
                <tr key={b.id}>
                  <td className={td}>
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-14 shrink-0 items-center justify-center overflow-hidden rounded border border-line bg-white">
                        {b.logoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={b.logoUrl} alt="" className="max-h-full max-w-full object-contain" />
                        ) : (
                          <span className="text-xs font-bold text-ink-faint">{b.name.slice(0, 2).toUpperCase()}</span>
                        )}
                      </span>
                      <span className="font-medium text-ink">{b.name}</span>
                    </div>
                  </td>
                  <td className={`${td} font-mono text-xs text-ink-soft`}>{b.slug}</td>
                  <td className={tdNum}>{b.productCount}</td>
                  <td className={`${td} whitespace-nowrap text-right`}>
                    <Button variant="ghost" size="sm" onClick={() => setEditing(b)}>
                      <Pencil className="size-4" aria-hidden />
                      Edit
                    </Button>
                    <DeleteButton
                      iconOnly
                      label={`Delete ${b.name}`}
                      title="Delete brand"
                      body={
                        <>
                          Delete <span className="font-semibold text-ink">{b.name}</span>?
                          {b.productCount > 0 ? ` Its ${b.productCount} product${b.productCount === 1 ? '' : 's'} will be left without a brand.` : ''}
                        </>
                      }
                      confirmLabel="Delete brand"
                      onConfirm={async () => {
                        try {
                          await del(`/admin/brands/${b.id}`);
                          toast('Brand deleted');
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
        <BrandForm
          key={editing === 'new' ? 'new' : editing.id}
          row={editing === 'new' ? null : editing}
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

function BrandForm({ row, onClose, onSaved }: { row: BrandRow | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [name, setName] = useState(row?.name ?? '');
  const [slug, setSlug] = useState(row?.slug ?? '');
  const [logoUrl, setLogoUrl] = useState(row?.logoUrl ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError('Enter the brand name');
      return;
    }
    setError(null);
    const body = { name: name.trim(), slug: slug.trim() || undefined, logoUrl: logoUrl || null };
    setBusy(true);
    try {
      if (row) await patch(`/admin/brands/${row.id}`, body);
      else await post('/admin/brands', body);
      toast(row ? 'Brand saved' : 'Brand added');
      onSaved();
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={row ? `Edit ${row.name}` : 'Add brand'}>
      <form onSubmit={submit} className="grid gap-4" noValidate>
        <Field label="Name" error={error}>
          <Input value={name} maxLength={60} onChange={(e) => setName(e.target.value)} autoFocus />
        </Field>
        <Field label="Slug" hint="Leave blank to create one from the name.">
          <Input value={slug} maxLength={80} onChange={(e) => setSlug(e.target.value)} />
        </Field>
        <ImageField label="Logo" value={logoUrl} onChange={setLogoUrl} aspect="16 / 10" previewWidth={140} hint="A logo on a white or clear background works best." />
        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={busy}>
            {row ? 'Save brand' : 'Add brand'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
