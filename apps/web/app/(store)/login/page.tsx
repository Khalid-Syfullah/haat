import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { LoginForm } from '@/components/store/auth-forms';
import { getMe } from '@/lib/server';

export const metadata: Metadata = { title: 'Log in' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const [{ user }, { next }] = await Promise.all([getMe(), searchParams]);
  if (user) redirect(next && next.startsWith('/') && !next.startsWith('//') ? next : '/');
  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <div className="rounded-xl border border-line bg-white p-6 sm:p-8">
        <h1 className="text-2xl font-bold">Log in to Tuktak Bazaar</h1>
        <p className="mb-6 mt-1 text-ink-soft">Track orders, use vouchers and earn coins.</p>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
      <p className="mt-4 text-center text-sm text-ink-faint">Demo logins: customer 01711111111 / customer123, admin admin@tuktakbazaar.local / admin1234</p>
    </div>
  );
}
