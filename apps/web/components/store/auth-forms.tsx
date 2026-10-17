'use client';

import clsx from 'clsx';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { ApiError, post } from '@/lib/api';
import { useSession } from '../providers';
import { Button, Field, Input } from '../ui';

function useAfterLogin() {
  const router = useRouter();
  const params = useSearchParams();
  const { refresh } = useSession();
  return async (role?: string) => {
    await refresh();
    const next = params.get('next');
    const safe = next && next.startsWith('/') && !next.startsWith('//') ? next : role === 'ADMIN' || role === 'STAFF' ? '/admin' : '/';
    router.replace(safe);
    router.refresh();
  };
}

export function LoginForm() {
  const [mode, setMode] = useState<'password' | 'otp'>('password');
  const params = useSearchParams();
  return (
    <div>
      <div className="mb-5 grid grid-cols-2 rounded-md bg-paper p-1" role="tablist">
        {(['password', 'otp'] as const).map((m) => (
          <button
            key={m}
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className={clsx('rounded py-2 text-[15px] font-semibold', mode === m ? 'bg-white text-ink shadow-sm' : 'text-ink-soft')}
          >
            {m === 'password' ? 'Password' : 'Code by SMS'}
          </button>
        ))}
      </div>
      {mode === 'password' ? <PasswordLogin /> : <OtpLogin />}
      <p className="mt-6 text-center text-[15px] text-ink-soft">
        New to Tuktak Bazaar?{' '}
        <Link href={`/register${params.get('next') ? `?next=${encodeURIComponent(params.get('next')!)}` : ''}`} className="font-semibold text-padma hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}

function PasswordLogin() {
  const done = useAfterLogin();
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await post<{ user: { role: string } }>('/auth/login', { login, password });
      await done(res.user.role);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not log in');
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Phone number or email">
        <Input value={login} onChange={(e) => setLogin(e.target.value)} required autoComplete="username" placeholder="01XXXXXXXXX" />
      </Field>
      <Field label="Password">
        <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
      </Field>
      {error && <p className="text-sm text-sindoor">{error}</p>}
      <Button type="submit" size="lg" block loading={busy}>
        Log in
      </Button>
    </form>
  );
}

function OtpLogin() {
  const done = useAfterLogin();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [isNew, setIsNew] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function requestCode(e?: FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await post<{ isNewUser: boolean; devCode?: string }>('/auth/otp/request', { phone });
      setIsNew(res.isNewUser);
      setDevCode(res.devCode ?? null);
      setStep('code');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send the code');
    } finally {
      setBusy(false);
    }
  }

  async function verify(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await post<{ user: { role: string } }>('/auth/otp/verify', { phone, code, name: isNew ? name : undefined });
      await done(res.user.role);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not verify the code');
      setBusy(false);
    }
  }

  if (step === 'phone') {
    return (
      <form onSubmit={requestCode} className="space-y-4">
        <Field label="Mobile number" hint="We'll text you a 6-digit code. New numbers get an account automatically.">
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} required inputMode="tel" autoComplete="tel" placeholder="01XXXXXXXXX" />
        </Field>
        {error && <p className="text-sm text-sindoor">{error}</p>}
        <Button type="submit" size="lg" block loading={busy}>
          Send code
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={verify} className="space-y-4">
      <p className="text-[15px] text-ink-soft">
        Enter the code sent to <span className="font-semibold text-ink">{phone}</span>.{' '}
        <button type="button" className="font-semibold text-padma" onClick={() => setStep('phone')}>
          Change number
        </button>
      </p>
      {devCode && (
        <p className="rounded-md bg-marigold-tint px-3 py-2 text-sm">
          Test mode: no SMS is sent. Your code is <span className="font-bold tracking-widest">{devCode}</span>
        </p>
      )}
      <Field label="6-digit code">
        <Input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} required inputMode="numeric" autoComplete="one-time-code" className="text-center text-xl tracking-[0.4em]" />
      </Field>
      {isNew && (
        <Field label="Your name">
          <Input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} autoComplete="name" />
        </Field>
      )}
      {error && <p className="text-sm text-sindoor">{error}</p>}
      <Button type="submit" size="lg" block loading={busy} disabled={code.length !== 6}>
        {isNew ? 'Create account' : 'Log in'}
      </Button>
      <button type="button" className="w-full text-sm font-semibold text-padma" onClick={() => requestCode()}>
        Send a new code
      </button>
    </form>
  );
}

export function RegisterForm() {
  const done = useAfterLogin();
  const params = useSearchParams();
  const [form, setForm] = useState({ name: '', phone: '', email: '', password: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await post('/auth/register', { ...form, email: form.email || undefined });
      await done();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create your account');
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Full name">
        <Input value={form.name} onChange={set('name')} required minLength={2} autoComplete="name" />
      </Field>
      <Field label="Mobile number">
        <Input value={form.phone} onChange={set('phone')} required inputMode="tel" autoComplete="tel" placeholder="01XXXXXXXXX" />
      </Field>
      <Field label="Email (optional)" hint="For order receipts">
        <Input type="email" value={form.email} onChange={set('email')} autoComplete="email" />
      </Field>
      <Field label="Password" hint="At least 6 characters">
        <Input type="password" value={form.password} onChange={set('password')} required minLength={6} autoComplete="new-password" />
      </Field>
      {error && <p className="text-sm text-sindoor">{error}</p>}
      <Button type="submit" size="lg" block loading={busy}>
        Create account
      </Button>
      <p className="text-center text-[15px] text-ink-soft">
        Already have an account?{' '}
        <Link href={`/login${params.get('next') ? `?next=${encodeURIComponent(params.get('next')!)}` : ''}`} className="font-semibold text-padma hover:underline">
          Log in
        </Link>
      </p>
    </form>
  );
}
