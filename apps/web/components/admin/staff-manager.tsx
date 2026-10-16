'use client';

import clsx from 'clsx';
import { Pencil, Plus, UserMinus } from 'lucide-react';
import { FormEvent, ReactNode, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button, Field, Input, Modal } from '@/components/ui';
import { patch, post } from '@/lib/api';
import { useAction } from './use-action';

export type StaffRole = 'ADMIN' | 'STAFF';

export interface StaffMember {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  role: StaffRole;
  permissions: string[];
  effectivePermissions: string[];
  isActive: boolean;
  createdAt: string;
  actions: number;
  lastActionAt: string | null;
}

export interface PermissionInfo {
  key: string;
  label: string;
  covers: string;
}

const BD_MOBILE = /^01[3-9]\d{8}$/;

/** 01712-345678, +8801712345678 and 01712 345 678 all become 01712345678. */
function localPhone(input: string) {
  const digits = input.replace(/\D/g, '');
  return digits.startsWith('880') ? digits.slice(2) : digits;
}

/**
 * Dialogs opened from a table row are moved to <body>, so they don't pick up the cell's
 * nowrap and small table text.
 */
function BodyPortal({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  useEffect(() => setTarget(document.body), []);
  return target ? createPortal(children, target) : null;
}

/** "Add staff member" button with its form. */
export function AddStaffButton({ permissions }: { permissions: PermissionInfo[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4" aria-hidden />
        Add staff member
      </Button>
      {open && <StaffForm permissions={permissions} onClose={() => setOpen(false)} />}
    </>
  );
}

/** Edit, disable / enable and remove access for one row. */
export function StaffRowActions({ member, permissions, isMe }: { member: StaffMember; permissions: PermissionInfo[]; isMe: boolean }) {
  const { run, busy } = useAction();
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState<'disable' | 'remove' | null>(null);
  const first = member.name.split(' ')[0];

  const setActive = async (isActive: boolean) => {
    const ok = await run('active', () => patch(`/admin/staff/${member.id}`, { isActive }), isActive ? `${member.name} can log in again` : `${member.name} is disabled`);
    if (ok) setConfirm(null);
  };

  const remove = async () => {
    const ok = await run('remove', () => post(`/admin/staff/${member.id}/remove`), `${member.name} no longer has admin access`);
    if (ok) setConfirm(null);
  };

  const selfHint = "You can't do this to your own account. Ask another owner.";

  return (
    <div className="flex items-center justify-end gap-1">
      <Button variant="ghost" size="sm" onClick={() => setEditing(true)} aria-label={`Edit ${member.name}`}>
        <Pencil className="size-4" aria-hidden />
        Edit
      </Button>
      {member.isActive ? (
        <Button variant="ghost" size="sm" disabled={isMe} title={isMe ? selfHint : undefined} onClick={() => setConfirm('disable')} aria-label={`Disable ${member.name}`}>
          Disable
        </Button>
      ) : (
        <Button variant="ghost" size="sm" className="text-padma" loading={busy === 'active'} onClick={() => setActive(true)} aria-label={`Enable ${member.name}`}>
          Enable
        </Button>
      )}
      <Button
        variant="ghost"
        size="sm"
        className="hover:text-sindoor"
        disabled={isMe}
        title={isMe ? selfHint : undefined}
        onClick={() => setConfirm('remove')}
        aria-label={`Remove admin access from ${member.name}`}
      >
        <UserMinus className="size-4" aria-hidden />
        Remove access
      </Button>

      <BodyPortal>
        {editing && <StaffForm member={member} permissions={permissions} isMe={isMe} onClose={() => setEditing(false)} />}

        <Modal open={confirm === 'disable'} onClose={() => setConfirm(null)} title={`Disable ${member.name}?`}>
          <p className="text-ink-soft">
            {first} will be logged out and won&apos;t be able to log in, to the admin panel or the store, until you enable the account again. Nothing they did is
            deleted.
          </p>
          <div className="mt-5 flex justify-end gap-2 border-t border-line pt-4">
            <Button variant="outline" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            <Button variant="danger" loading={busy === 'active'} onClick={() => setActive(false)}>
              Disable account
            </Button>
          </div>
        </Modal>

        <Modal open={confirm === 'remove'} onClose={() => setConfirm(null)} title={`Remove ${member.name}'s admin access?`}>
          <div className="space-y-2 text-ink-soft">
            <p>{first} won&apos;t be able to open the admin panel any more. Support tickets assigned to them go back to the shared queue.</p>
            <p>
              Their account stays as a normal customer account, so they can still log in with <span className="font-medium text-ink tabular-nums">{member.phone}</span> and
              shop. You can give access again later with Add staff member.
            </p>
          </div>
          <div className="mt-5 flex justify-end gap-2 border-t border-line pt-4">
            <Button variant="outline" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            <Button variant="danger" loading={busy === 'remove'} onClick={remove}>
              Remove access
            </Button>
          </div>
        </Modal>
      </BodyPortal>
    </div>
  );
}

type Errors = Partial<Record<'name' | 'phone' | 'email' | 'password' | 'permissions', string>>;

function StaffForm({ member, permissions, isMe = false, onClose }: { member?: StaffMember; permissions: PermissionInfo[]; isMe?: boolean; onClose: () => void }) {
  const { run, busy } = useAction();
  const editing = Boolean(member);
  const [name, setName] = useState(member?.name ?? '');
  const [phone, setPhone] = useState(member?.phone ?? '');
  const [email, setEmail] = useState(member?.email ?? '');
  const [role, setRole] = useState<StaffRole>(member?.role ?? 'STAFF');
  const [perms, setPerms] = useState<string[]>(member?.permissions ?? []);
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Errors>({});

  const toggle = (key: string, on: boolean) => setPerms((cur) => (on ? [...cur, key] : cur.filter((p) => p !== key)));
  // Keep the order the API lists them in, so audit entries read the same way every time.
  const ordered = permissions.map((p) => p.key).filter((k) => perms.includes(k));

  const validate = (): Errors => {
    const e: Errors = {};
    if (name.trim().length < 2) e.name = 'Enter their name';
    if (!editing) {
      if (!BD_MOBILE.test(localPhone(phone))) e.phone = 'Enter a Bangladeshi mobile number, e.g. 01712345678';
      if (email.trim() && !/^\S+@\S+\.\S+$/.test(email.trim())) e.email = 'Enter a valid email address, or leave it empty';
    }
    if (password && password.length < 8) e.password = 'Use at least 8 characters';
    if (role === 'STAFF' && ordered.length === 0) e.permissions = 'Tick at least one area this person can work in';
    return e;
  };

  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) {
      requestAnimationFrame(() => document.querySelector<HTMLElement>('dialog[open] [aria-invalid="true"]')?.focus());
      return;
    }

    if (!member) {
      const body = {
        name: name.trim(),
        phone: localPhone(phone),
        email: email.trim() || undefined,
        password: password || undefined,
        role,
        permissions: role === 'ADMIN' ? [] : ordered,
      };
      const out = await run('save', () => post<StaffMember>('/admin/staff', body), `${body.name} can now use the admin panel`);
      if (out) onClose();
      return;
    }

    // Send only what changed, so the audit log says exactly what happened.
    const body: Record<string, unknown> = {};
    if (name.trim() !== member.name) body.name = name.trim();
    if (role !== member.role) body.role = role;
    const before = permissions.map((p) => p.key).filter((k) => member.permissions.includes(k));
    if (role === 'STAFF' && (role !== member.role || before.join() !== ordered.join())) body.permissions = ordered;
    if (password) body.password = password;
    if (Object.keys(body).length === 0) {
      onClose();
      return;
    }
    const out = await run('save', () => patch<StaffMember>(`/admin/staff/${member.id}`, body), `Saved changes for ${name.trim()}`);
    if (out) onClose();
  };

  return (
    <Modal open onClose={onClose} title={member ? `Edit ${member.name}` : 'Add staff member'} wide>
      <form onSubmit={submit} noValidate className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" error={errors.name} className="sm:col-span-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoComplete="off" aria-invalid={!!errors.name} autoFocus={!editing} />
          </Field>
          {member ? (
            <div className="rounded-md bg-paper px-3 py-2 text-sm sm:col-span-2">
              <p className="text-ink">
                <span className="tabular-nums">{member.phone}</span>
                {member.email && <span className="text-ink-soft"> · {member.email}</span>}
              </p>
              <p className="text-xs text-ink-soft">They log in with this phone number{member.email ? ' or email' : ''}. It can&apos;t be changed here.</p>
            </div>
          ) : (
            <>
              <Field label="Mobile number" hint="They log in with this number." error={errors.phone}>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  inputMode="tel"
                  autoComplete="off"
                  placeholder="01712345678"
                  maxLength={16}
                  className="tabular-nums"
                  aria-invalid={!!errors.phone}
                />
              </Field>
              <Field label="Email (optional)" hint="They can log in with this too." error={errors.email}>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" aria-invalid={!!errors.email} />
              </Field>
            </>
          )}
        </div>

        <fieldset>
          <legend className="mb-2 text-sm font-medium text-ink">Role</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {(
              [
                { value: 'ADMIN', title: 'Owner', body: 'Can do everything, including adding staff and reading the audit log.' },
                { value: 'STAFF', title: 'Staff', body: 'Only sees the parts of the admin panel you tick below.' },
              ] as const
            ).map((r) => {
              const lockedOut = isMe && r.value === 'STAFF';
              return (
                <label
                  key={r.value}
                  className={clsx(
                    'flex items-start gap-2.5 rounded-md border p-3 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-marigold',
                    role === r.value ? 'border-padma bg-padma-tint/50' : 'border-line',
                    lockedOut ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
                  )}
                >
                  <input
                    type="radio"
                    name="role"
                    value={r.value}
                    checked={role === r.value}
                    disabled={lockedOut}
                    onChange={() => setRole(r.value)}
                    className="mt-1 size-4 shrink-0 accent-padma"
                  />
                  <span>
                    <span className="block font-medium text-ink">{r.title}</span>
                    <span className="block text-sm text-ink-soft">{r.body}</span>
                  </span>
                </label>
              );
            })}
          </div>
          {isMe && <p className="mt-1.5 text-xs text-ink-soft">You can&apos;t make yourself staff. Another owner can change your role.</p>}
        </fieldset>

        {role === 'STAFF' && (
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-ink">What they can do</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {permissions.map((p) => (
                <label
                  key={p.key}
                  className={clsx(
                    'flex cursor-pointer items-start gap-2.5 rounded-md border p-3 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-marigold',
                    perms.includes(p.key) ? 'border-padma bg-padma-tint/50' : 'border-line',
                  )}
                >
                  <input
                    type="checkbox"
                    checked={perms.includes(p.key)}
                    onChange={(e) => toggle(p.key, e.target.checked)}
                    className="mt-1 size-4 shrink-0 accent-padma"
                    aria-invalid={!!errors.permissions}
                  />
                  <span>
                    <span className="block font-medium text-ink">{p.label}</span>
                    <span className="block text-sm text-ink-soft">{p.covers}</span>
                  </span>
                </label>
              ))}
            </div>
            {errors.permissions ? (
              <p className="mt-1.5 text-sm text-sindoor">{errors.permissions}</p>
            ) : (
              <p className="mt-1.5 text-xs text-ink-soft">Everyone can see the dashboard. Sales figures need Reports.</p>
            )}
          </fieldset>
        )}

        <div className="sm:max-w-sm">
          <Field
            label={editing ? 'Set a new password (optional)' : 'Password'}
            hint={
              editing
                ? 'Leave empty to keep their current password.'
                : 'At least 8 characters. You can leave it empty if this number already has a customer account; they keep their current password.'
            }
            error={errors.password}
          >
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" maxLength={72} aria-invalid={!!errors.password} />
          </Field>
        </div>

        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={busy === 'save'}>
            {editing ? 'Save changes' : 'Add staff member'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
