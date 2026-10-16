'use client';

import { Image as ImageIcon, Pencil, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { useToast } from '@/components/providers';
import { Button, EmptyState, Field, Input, Modal, Select } from '@/components/ui';
import { del, patch, post } from '@/lib/api';
import { dateTime } from '@/lib/format';
import { DeleteButton, ImageField, Toggle } from './common';
import { errorMessage, fromDhakaInput, Panel, PanelTitle, phaseOf, PhaseBadge, toDhakaInput } from './utils';

export type Placement = 'HOME_HERO' | 'HOME_STRIP';

export interface BannerRow {
  id: string;
  title: string;
  subtitle: string | null;
  imageUrl: string;
  link: string;
  placement: Placement;
  sortOrder: number;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
}

const PLACEMENTS: { value: Placement; title: string; description: string; size: string; aspect: string }[] = [
  { value: 'HOME_HERO', title: 'Hero carousel', description: 'Large rotating banners at the top of the home page.', size: '1600 × 560', aspect: '1600 / 560' },
  { value: 'HOME_STRIP', title: 'Strip', description: 'Smaller promo tiles below the categories.', size: '800 × 260', aspect: '800 / 260' },
];

function schedule(b: BannerRow) {
  if (b.startsAt && b.endsAt) return `${dateTime(b.startsAt)} to ${dateTime(b.endsAt)}`;
  if (b.startsAt) return `From ${dateTime(b.startsAt)}`;
  if (b.endsAt) return `Until ${dateTime(b.endsAt)}`;
  return 'Always on';
}

export function BannerManager({ banners }: { banners: BannerRow[] }) {
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState<BannerRow | { placement: Placement } | null>(null);
  const [now] = useState(() => Date.now());

  return (
    <div className="flex flex-col gap-5">
      {PLACEMENTS.map((p) => {
        const rows = banners.filter((b) => b.placement === p.value);
        return (
          <Panel key={p.value}>
            <PanelTitle
              title={p.title}
              description={`${p.description} Upload at ${p.size} pixels.`}
              actions={
                <Button size="sm" onClick={() => setEditing({ placement: p.value })}>
                  <Plus className="size-4" aria-hidden />
                  Add banner
                </Button>
              }
            />
            {rows.length === 0 ? (
              <EmptyState icon={<ImageIcon className="size-8" />} title={`No ${p.title.toLowerCase()} banners`} body={`Add a ${p.size} image to fill this spot on the home page.`} />
            ) : (
              <ul className="divide-y divide-line">
                {rows.map((b) => (
                  <li key={b.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                    <div className="w-full shrink-0 overflow-hidden rounded-[6px] border border-line bg-paper sm:w-64" style={{ aspectRatio: p.aspect }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={b.imageUrl} alt={b.title} className="size-full object-cover" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-ink">{b.title}</p>
                        <PhaseBadge phase={phaseOf(b.startsAt, b.endsAt, b.isActive, now)} liveLabel="Showing" />
                      </div>
                      {b.subtitle && <p className="text-sm text-ink-soft">{b.subtitle}</p>}
                      <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-sm">
                        <dt className="text-ink-faint">Link</dt>
                        <dd className="truncate font-mono text-xs leading-5 text-ink-soft">{b.link}</dd>
                        <dt className="text-ink-faint">Order</dt>
                        <dd className="tabular-nums text-ink-soft">{b.sortOrder}</dd>
                        <dt className="text-ink-faint">Schedule</dt>
                        <dd className="text-ink-soft">{schedule(b)}</dd>
                      </dl>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button variant="outline" size="sm" onClick={() => setEditing(b)}>
                        <Pencil className="size-4" aria-hidden />
                        Edit
                      </Button>
                      <DeleteButton
                        title="Delete banner"
                        body={
                          <>
                            Delete <span className="font-semibold text-ink">{b.title}</span>? To keep it for later, switch it off instead.
                          </>
                        }
                        confirmLabel="Delete banner"
                        onConfirm={async () => {
                          try {
                            await del(`/admin/banners/${b.id}`);
                            toast('Banner deleted');
                            router.refresh();
                          } catch (e) {
                            toast(errorMessage(e), 'error');
                          }
                        }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        );
      })}
      {editing && (
        <BannerForm
          key={'id' in editing ? editing.id : `new-${editing.placement}`}
          row={'id' in editing ? editing : null}
          placement={editing.placement}
          nextOrder={banners.filter((b) => b.placement === editing.placement).reduce((m, b) => Math.max(m, b.sortOrder + 1), 0)}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function BannerForm({
  row,
  placement,
  nextOrder,
  onClose,
  onSaved,
}: {
  row: BannerRow | null;
  placement: Placement;
  nextOrder: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [f, setF] = useState({
    title: row?.title ?? '',
    subtitle: row?.subtitle ?? '',
    imageUrl: row?.imageUrl ?? '',
    link: row?.link ?? '/',
    placement: row?.placement ?? placement,
    sortOrder: String(row?.sortOrder ?? nextOrder),
    isActive: row?.isActive ?? true,
    startsAt: toDhakaInput(row?.startsAt),
    endsAt: toDhakaInput(row?.endsAt),
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
  const spec = PLACEMENTS.find((p) => p.value === f.placement)!;

  async function submit(e: FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (f.title.trim().length < 2) errs.title = 'Enter at least 2 characters';
    if (!f.imageUrl) errs.imageUrl = 'Upload the banner image';
    if (!f.link.trim()) errs.link = 'Enter where the banner leads, e.g. /flash-sale';
    if (f.sortOrder.trim() === '' || !Number.isInteger(Number(f.sortOrder))) errs.sortOrder = 'Enter a whole number';
    const startsAt = fromDhakaInput(f.startsAt);
    const endsAt = fromDhakaInput(f.endsAt);
    if (startsAt && endsAt && endsAt <= startsAt) errs.endsAt = 'End must be after the start';
    setErrors(errs);
    if (Object.keys(errs).length) {
      if (errs.imageUrl) toast(errs.imageUrl, 'error');
      return;
    }
    const body = {
      title: f.title.trim(),
      subtitle: f.subtitle.trim() || null,
      imageUrl: f.imageUrl,
      link: f.link.trim(),
      placement: f.placement,
      sortOrder: Number(f.sortOrder),
      isActive: f.isActive,
      startsAt,
      endsAt,
    };
    setBusy(true);
    try {
      if (row) await patch(`/admin/banners/${row.id}`, body);
      else await post('/admin/banners', body);
      toast(row ? 'Banner saved' : 'Banner added');
      onSaved();
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={row ? 'Edit banner' : 'Add banner'} wide>
      <form onSubmit={submit} className="grid gap-4" noValidate>
        <Field label="Placement">
          <Select value={f.placement} onChange={(e) => set('placement', e.target.value as Placement)}>
            {PLACEMENTS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.title} ({p.size})
              </option>
            ))}
          </Select>
        </Field>
        <ImageField
          label="Image"
          value={f.imageUrl}
          onChange={(v) => set('imageUrl', v)}
          aspect={spec.aspect}
          previewWidth={f.placement === 'HOME_HERO' ? 360 : 240}
          hint={errors.imageUrl ?? `${spec.size} pixels, JPG, PNG or WEBP under 3 MB.`}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Title" error={errors.title} hint="Also used as the image description for screen readers.">
            <Input value={f.title} maxLength={80} onChange={(e) => set('title', e.target.value)} />
          </Field>
          <Field label="Subtitle (optional)">
            <Input value={f.subtitle} maxLength={160} onChange={(e) => set('subtitle', e.target.value)} />
          </Field>
          <Field label="Link" error={errors.link} hint="A store path such as /flash-sale or /category/fashion">
            <Input value={f.link} maxLength={300} onChange={(e) => set('link', e.target.value)} />
          </Field>
          <Field label="Order" error={errors.sortOrder} hint="Lower numbers show first.">
            <Input type="number" inputMode="numeric" value={f.sortOrder} onChange={(e) => set('sortOrder', e.target.value)} />
          </Field>
          <Field label="Show from (Dhaka time, optional)">
            <Input type="datetime-local" value={f.startsAt} onChange={(e) => set('startsAt', e.target.value)} />
          </Field>
          <Field label="Show until (Dhaka time, optional)" error={errors.endsAt}>
            <Input type="datetime-local" value={f.endsAt} onChange={(e) => set('endsAt', e.target.value)} />
          </Field>
        </div>
        <Toggle label="Active" hint="Switched-off banners stay saved but are not shown." checked={f.isActive} onChange={(v) => set('isActive', v)} />
        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={busy}>
            {row ? 'Save banner' : 'Add banner'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
