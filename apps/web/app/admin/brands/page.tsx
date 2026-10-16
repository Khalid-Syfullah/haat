import type { Metadata } from 'next';
import { AdminHeader } from '@/components/admin/shell';
import { BrandManager, BrandRow } from '@/components/admin/catalog/brand-manager';
import { serverApi } from '@/lib/server';

export const metadata: Metadata = { title: 'Brands' };

export default async function BrandsPage() {
  const brands = (await serverApi<BrandRow[]>('/admin/brands')) ?? [];
  return (
    <>
      <AdminHeader title="Brands" description={`${brands.length} brand${brands.length === 1 ? '' : 's'}`} />
      <BrandManager brands={brands} />
    </>
  );
}
