import type { Metadata } from 'next';
import { AddressBook } from '@/components/store/account-widgets';
import { getMe, serverApi } from '@/lib/server';
import type { Address } from '@/lib/types';

export const metadata: Metadata = { title: 'Addresses' };

export default async function AddressesPage() {
  const [me, addresses] = await Promise.all([getMe(), serverApi<Address[]>('/account/addresses')]);
  return <AddressBook initial={addresses ?? []} user={{ name: me.user?.name ?? '', phone: me.user?.phone ?? '' }} />;
}
