import type { Metadata } from 'next';
import { NotificationList } from '@/components/store/account-widgets';
import { serverApi } from '@/lib/server';

export const metadata: Metadata = { title: 'Notifications' };

export default async function NotificationsPage() {
  const data = await serverApi<{ items: { id: string; type: string; title: string; body: string; link: string | null; readAt: string | null; createdAt: string }[] }>('/notifications');
  return <NotificationList items={data?.items ?? []} />;
}
