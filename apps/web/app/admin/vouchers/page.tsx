import type { Metadata } from 'next';
import { AdminHeader } from '@/components/admin/shell';
import { VoucherManager, VoucherRow } from '@/components/admin/catalog/voucher-manager';
import { serverApi } from '@/lib/server';

export const metadata: Metadata = { title: 'Vouchers' };

export default async function VouchersPage() {
  const vouchers = (await serverApi<VoucherRow[]>('/admin/vouchers')) ?? [];
  return (
    <>
      <AdminHeader title="Vouchers" description="Discount codes. Collectible vouchers also show on product and cart pages." />
      <VoucherManager vouchers={vouchers} />
    </>
  );
}
