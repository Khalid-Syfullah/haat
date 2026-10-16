import type { Metadata } from 'next';
import { IntegrationsPanel, SystemStatus } from '@/components/admin/integrations-panel';
import { AppSettings, SettingsForm } from '@/components/admin/settings-form';
import { AdminHeader } from '@/components/admin/shell';
import { mustGet } from '@/lib/server';

export const metadata: Metadata = { title: 'Settings' };

export default async function SettingsPage() {
  const [settings, system] = await Promise.all([mustGet<AppSettings>('/admin/settings'), mustGet<SystemStatus>('/admin/system')]);
  return (
    <>
      <AdminHeader
        title="Settings"
        description="Store rules for delivery, cash on delivery, coins, orders, reminders and returns. Changes apply to new orders."
      />
      {/* Bottom padding keeps the last panel clear of the form's fixed save bar */}
      <div className="space-y-8 pb-24">
        <SettingsForm initial={settings} />
        <IntegrationsPanel system={system} />
      </div>
    </>
  );
}
