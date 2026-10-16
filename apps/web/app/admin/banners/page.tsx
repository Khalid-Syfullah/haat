import type { Metadata } from 'next';
import { AdminHeader } from '@/components/admin/shell';
import { BannerManager, BannerRow } from '@/components/admin/catalog/banner-manager';
import { serverApi } from '@/lib/server';

export const metadata: Metadata = { title: 'Banners' };

export default async function BannersPage() {
  const banners = (await serverApi<BannerRow[]>('/admin/banners')) ?? [];
  return (
    <>
      <AdminHeader title="Banners" description="Home page artwork. Lower order numbers show first." />
      <BannerManager banners={banners} />
    </>
  );
}
