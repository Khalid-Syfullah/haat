import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { RegisterForm } from '@/components/store/auth-forms';
import { getMe } from '@/lib/server';

export const metadata: Metadata = { title: 'Create an account' };

export default async function RegisterPage() {
  const { user } = await getMe();
  if (user) redirect('/account');
  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <div className="rounded-xl border border-line bg-white p-6 sm:p-8">
        <h1 className="text-2xl font-bold">Create your account</h1>
        <p className="mb-6 mt-1 text-ink-soft">Shop from all over Bangladesh with cash on delivery.</p>
        <Suspense>
          <RegisterForm />
        </Suspense>
      </div>
    </div>
  );
}
