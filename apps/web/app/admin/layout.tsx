import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AdminShell } from '@/components/admin/shell';
import { getMe, serverApi } from '@/lib/server';

export const metadata: Metadata = { title: { default: 'Admin', template: '%s | Haat admin' }, robots: { index: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const me = await getMe();
  if (!me.user) redirect('/login?next=/admin');
  if (me.user.role !== 'ADMIN') redirect('/');
  const store = await serverApi<{ store: { name: string } }>('/store');
  return (
    <AdminShell name={me.user.name} storeName={store?.store.name ?? 'Haat'}>
      {children}
    </AdminShell>
  );
}
