import type { Metadata } from 'next';
import { AccountNav } from '@/components/store/account-nav';
import { requireUser } from '@/lib/server';

export const metadata: Metadata = { title: { default: 'My account', template: '%s | Haat' }, robots: { index: false } };

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  await requireUser('/account');
  return (
    <div className="mx-auto grid max-w-[1240px] gap-4 px-3 py-4 sm:px-4 sm:py-6 lg:grid-cols-[230px_1fr] lg:items-start">
      <AccountNav />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
