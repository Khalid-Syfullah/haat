'use client';

import clsx from 'clsx';
import { Bell, MapPin, Pencil, Star, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { ApiError, del, patch, post } from '@/lib/api';
import { date, relative, tk, voucherValue } from '@/lib/format';
import type { Address } from '@/lib/types';
import { useSession, useToast } from '../providers';
import { Button, EmptyState, Field, Input, Modal, Textarea } from '../ui';
import { AddressForm } from './address-form';
import { PhotoPicker } from './order-actions';

// ───── Reviews ─────

export interface PendingReview {
  orderItemId: string;
  orderNo: string;
  title: string;
  variantLabel: string | null;
  imageUrl: string | null;
  deliveredAt: string | null;
}

export function WriteReviewButton({ item, reward }: { item: PendingReview; reward: number }) {
  const router = useRouter();
  const toast = useToast();
  const { refresh } = useSession();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const words = ['', 'Poor', 'Not good', 'Okay', 'Good', 'Excellent'];

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await post<{ coinsEarned: number }>('/reviews', { orderItemId: item.orderItemId, rating, comment, images });
      toast(`Thanks for your review! You earned ${res.coinsEarned} coins.`);
      setOpen(false);
      await refresh();
      router.refresh();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not post your review', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        Write review
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Rate this product">
        <form onSubmit={submit} className="space-y-4">
          <p className="text-[15px] font-medium">{item.title}</p>
          <div>
            <div className="flex items-center gap-1" onMouseLeave={() => setHover(0)} role="radiogroup" aria-label="Rating">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={rating === n}
                  aria-label={`${n} star${n > 1 ? 's' : ''}`}
                  onMouseEnter={() => setHover(n)}
                  onClick={() => setRating(n)}
                >
                  <Star className={clsx('size-8', n <= (hover || rating) ? 'fill-marigold text-marigold' : 'text-line')} strokeWidth={1.5} />
                </button>
              ))}
              <span className="ml-2 text-[15px] font-semibold">{words[hover || rating]}</span>
            </div>
          </div>
          <Field label="Your review (optional)">
            <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={4} maxLength={1000} placeholder="How is the quality? Does it match the photos?" />
          </Field>
          <div>
            <p className="mb-1 text-sm font-medium">Add photos</p>
            <PhotoPicker value={images} onChange={setImages} />
          </div>
          <Button type="submit" block loading={busy}>
            Post review and earn {reward} coins
          </Button>
        </form>
      </Modal>
    </>
  );
}

// ───── Wishlist ─────

export function WishlistRemove({ productId }: { productId: string }) {
  const router = useRouter();
  const toast = useToast();
  return (
    <button
      className="absolute right-2 top-2 z-10 rounded-full bg-white/90 p-1.5 text-ink-soft shadow-sm hover:text-sindoor"
      aria-label="Remove from wishlist"
      onClick={async () => {
        await del(`/wishlist/${productId}`);
        toast('Removed from wishlist');
        router.refresh();
      }}
    >
      <Trash2 className="size-4" />
    </button>
  );
}

// ───── Coins ─────

export function CheckInButton({ canCheckIn, reward }: { canCheckIn: boolean; reward: number }) {
  const router = useRouter();
  const toast = useToast();
  const { refresh } = useSession();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="deal"
      size="lg"
      disabled={!canCheckIn}
      loading={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const res = await post<{ earned: number }>('/coins/check-in');
          toast(`You earned ${res.earned} coins`);
          await refresh();
          router.refresh();
        } catch (e) {
          toast(e instanceof ApiError ? e.message : 'Could not check in', 'error');
        } finally {
          setBusy(false);
        }
      }}
    >
      {canCheckIn ? `Check in for ${reward} coins` : 'Checked in today'}
    </Button>
  );
}

// ───── Vouchers ─────

export interface VoucherCardData {
  id: string;
  code: string;
  title: string;
  description?: string | null;
  type: string;
  value: number;
  maxDiscount: number | null;
  minSpend: number;
  endsAt: string;
  collected?: boolean;
  fullyUsed?: boolean;
  state?: 'available' | 'used' | 'expired';
}

export function VoucherCard({ v, collectable }: { v: VoucherCardData; collectable?: boolean }) {
  const toast = useToast();
  const router = useRouter();
  const { user } = useSession();
  const [collected, setCollected] = useState(!!v.collected);
  const [copied, setCopied] = useState(false);
  const dim = v.state && v.state !== 'available';

  async function collect() {
    if (!user) return router.push('/login?next=/vouchers');
    try {
      await post(`/vouchers/${v.id}/collect`);
      setCollected(true);
      toast('Voucher collected');
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Could not collect', 'error');
    }
  }

  return (
    <div className={clsx('ticket flex items-stretch', dim && 'opacity-55')} style={{ ['--ticket-bg' as string]: 'var(--color-paper)' }}>
      <div className="flex w-28 shrink-0 flex-col justify-center px-4 py-4">
        <p className="text-xl font-bold leading-tight text-marigold-dark">{voucherValue(v)}</p>
        {v.maxDiscount ? <p className="text-xs text-ink-soft">up to {tk(v.maxDiscount)}</p> : null}
      </div>
      <div className="ticket-divider" />
      <div className="flex min-w-0 flex-1 flex-col justify-center px-4 py-3">
        <p className="font-semibold">{v.title}</p>
        <p className="text-sm text-ink-soft">{v.minSpend ? `Min. spend ${tk(v.minSpend)}` : 'No minimum spend'}</p>
        <p className="text-xs text-ink-faint">Valid till {date(v.endsAt)}</p>
      </div>
      <div className="flex shrink-0 items-center pr-4">
        {collectable ? (
          <Button size="sm" variant={collected ? 'ghost' : 'primary'} disabled={collected || v.fullyUsed} onClick={collect}>
            {v.fullyUsed ? 'All claimed' : collected ? 'Collected' : 'Collect'}
          </Button>
        ) : v.state === 'available' ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              navigator.clipboard?.writeText(v.code);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? 'Copied' : v.code}
          </Button>
        ) : (
          <span className="text-sm font-semibold text-ink-soft">{v.state === 'used' ? 'Used' : 'Expired'}</span>
        )}
      </div>
    </div>
  );
}

// ───── Addresses ─────

export function AddressBook({ initial, user }: { initial: Address[]; user: { name: string; phone: string } }) {
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState<Address | 'new' | null>(null);

  async function remove(a: Address) {
    if (!confirm(`Delete the ${a.label.toLowerCase()} address?`)) return;
    await del(`/account/addresses/${a.id}`);
    toast('Address deleted');
    router.refresh();
  }

  async function makeDefault(a: Address) {
    await patch(`/account/addresses/${a.id}`, { ...a, isDefault: true });
    toast('Default address updated');
    router.refresh();
  }

  return (
    <>
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-xl font-bold">Addresses</h1>
        <Button onClick={() => setEditing('new')}>Add address</Button>
      </div>
      {initial.length === 0 ? (
        <div className="rounded-[var(--radius-card)] border border-line bg-white">
          <EmptyState icon={<MapPin className="size-10" />} title="No saved addresses" body="Save your home or office address to check out faster." />
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {initial.map((a) => (
            <li key={a.id} className={clsx('rounded-[var(--radius-card)] border bg-white p-4 text-[15px]', a.isDefault ? 'border-padma' : 'border-line')}>
              <div className="flex items-center gap-2">
                <span className="rounded bg-black/5 px-1.5 py-0.5 text-xs font-semibold text-ink-soft">{a.label}</span>
                {a.isDefault && <span className="text-sm font-semibold text-padma">Default</span>}
              </div>
              <p className="mt-2 font-semibold">{a.fullName}</p>
              <p className="text-ink-soft">{a.phone}</p>
              <p className="text-ink-soft">
                {a.line}, {a.area}, {a.district}, {a.division}
              </p>
              <div className="mt-3 flex gap-4 text-sm font-semibold">
                <button className="flex items-center gap-1 text-padma" onClick={() => setEditing(a)}>
                  <Pencil className="size-3.5" /> Edit
                </button>
                {!a.isDefault && (
                  <button className="text-ink-soft hover:text-ink" onClick={() => makeDefault(a)}>
                    Make default
                  </button>
                )}
                <button className="ml-auto text-ink-soft hover:text-sindoor" onClick={() => remove(a)}>
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing === 'new' ? 'New address' : 'Edit address'} wide>
        {editing && (
          <AddressForm
            key={editing === 'new' ? 'new' : editing.id}
            address={editing === 'new' ? undefined : editing}
            defaultName={user.name}
            defaultPhone={user.phone}
            onSaved={() => {
              setEditing(null);
              router.refresh();
            }}
          />
        )}
      </Modal>
    </>
  );
}

// ───── Notifications ─────

export function NotificationList({ items }: { items: { id: string; title: string; body: string; link: string | null; readAt: string | null; createdAt: string }[] }) {
  const router = useRouter();
  const { refresh } = useSession();
  const unread = items.some((n) => !n.readAt);
  return (
    <>
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-xl font-bold">Notifications</h1>
        {unread && (
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              await post('/notifications/read-all');
              await refresh();
              router.refresh();
            }}
          >
            Mark all as read
          </Button>
        )}
      </div>
      {items.length === 0 ? (
        <div className="rounded-[var(--radius-card)] border border-line bg-white">
          <EmptyState icon={<Bell className="size-10" />} title="No notifications yet" body="Order updates, replies and offers will appear here." />
        </div>
      ) : (
        <ul className="divide-y divide-line rounded-[var(--radius-card)] border border-line bg-white">
          {items.map((n) => {
            const body = (
              <>
                <span className={clsx('mt-2 size-2 shrink-0 rounded-full', n.readAt ? 'bg-transparent' : 'bg-sindoor')} />
                <span className="min-w-0 flex-1">
                  <span className={clsx('block text-[15px]', !n.readAt && 'font-semibold')}>{n.title}</span>
                  <span className="block text-[15px] text-ink-soft">{n.body}</span>
                  <span className="block text-xs text-ink-faint">{relative(n.createdAt)}</span>
                </span>
              </>
            );
            return (
              <li key={n.id}>
                {n.link ? (
                  <Link
                    href={n.link}
                    className="flex gap-3 px-4 py-3 hover:bg-paper"
                    onClick={() => !n.readAt && post(`/notifications/${n.id}/read`).then(refresh)}
                  >
                    {body}
                  </Link>
                ) : (
                  <div className="flex gap-3 px-4 py-3">{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

// ───── Profile ─────

export function ProfileForms({ profile }: { profile: { name: string; phone: string; email: string | null; hasPassword: boolean } }) {
  const toast = useToast();
  const { refresh } = useSession();
  const [name, setName] = useState(profile.name);
  const [email, setEmail] = useState(profile.email ?? '');
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [busy, setBusy] = useState<'profile' | 'password' | null>(null);

  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    setBusy('profile');
    try {
      await patch('/account/profile', { name, email: email || undefined });
      await refresh();
      toast('Profile saved');
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not save', 'error');
    } finally {
      setBusy(null);
    }
  }

  async function savePassword(e: FormEvent) {
    e.preventDefault();
    setBusy('password');
    try {
      await post('/account/password', { current: current || undefined, next });
      setCurrent('');
      setNext('');
      toast('Password updated');
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not change password', 'error');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <form onSubmit={saveProfile} className="space-y-3 rounded-[var(--radius-card)] border border-line bg-white p-4 sm:p-5">
        <h2 className="font-semibold">Your details</h2>
        <Field label="Full name">
          <Input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
        </Field>
        <Field label="Mobile number" hint="Contact support to change your number">
          <Input value={profile.phone} disabled />
        </Field>
        <Field label="Email">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Button type="submit" loading={busy === 'profile'}>
          Save details
        </Button>
      </form>
      <form onSubmit={savePassword} className="space-y-3 rounded-[var(--radius-card)] border border-line bg-white p-4 sm:p-5">
        <h2 className="font-semibold">{profile.hasPassword ? 'Change password' : 'Set a password'}</h2>
        {!profile.hasPassword && <p className="text-sm text-ink-soft">You signed up with an SMS code. Add a password to log in without one.</p>}
        {profile.hasPassword && (
          <Field label="Current password">
            <Input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required autoComplete="current-password" />
          </Field>
        )}
        <Field label="New password" hint="At least 6 characters">
          <Input type="password" value={next} onChange={(e) => setNext(e.target.value)} required minLength={6} autoComplete="new-password" />
        </Field>
        <Button type="submit" loading={busy === 'password'}>
          {profile.hasPassword ? 'Change password' : 'Set password'}
        </Button>
      </form>
    </div>
  );
}
