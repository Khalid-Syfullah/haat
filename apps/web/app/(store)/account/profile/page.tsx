import type { Metadata } from 'next';
import { ProfileForms } from '@/components/store/account-widgets';
import { serverApi } from '@/lib/server';

export const metadata: Metadata = { title: 'Profile' };

export default async function ProfilePage() {
  const data = await serverApi<{ user: { name: string; phone: string; email: string | null; hasPassword: boolean } }>('/account/profile');
  if (!data) return null;
  return (
    <div>
      <h1 className="mb-3 text-xl font-bold">Profile</h1>
      <ProfileForms profile={data.user} />
    </div>
  );
}
