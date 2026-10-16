import type { Metadata } from 'next';
import { AppSettings, SettingsForm } from '@/components/admin/settings-form';
import { AdminHeader } from '@/components/admin/shell';
import { mustGet } from '@/lib/server';

export const metadata: Metadata = { title: 'Settings' };

export default async function SettingsPage() {
  const settings = await mustGet<AppSettings>('/admin/settings');
  return (
    <>
      <AdminHeader title="Settings" description="Store rules for delivery, cash on delivery, coins, orders and returns. Changes apply to new orders." />
      <SettingsForm initial={settings} />
    </>
  );
}
