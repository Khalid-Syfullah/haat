import { Ticket } from 'lucide-react';
import type { Metadata } from 'next';
import { VoucherCard, VoucherCardData } from '@/components/store/account-widgets';
import { EmptyState } from '@/components/ui';
import { serverApi } from '@/lib/server';

export const metadata: Metadata = { title: 'Vouchers' };

export default async function VouchersPage() {
  const rows = (await serverApi<VoucherCardData[]>('/vouchers/collectible')) ?? [];
  return (
    <div className="mx-auto max-w-[1000px] px-3 py-5 sm:px-4">
      <h1 className="text-2xl font-bold">Store vouchers</h1>
      <p className="mb-4 mt-1 text-ink-soft">Collect a voucher now and pick it at checkout. Each one shows its minimum spend and end date.</p>
      {rows.length === 0 ? (
        <div className="rounded-[var(--radius-card)] border border-line bg-white">
          <EmptyState icon={<Ticket className="size-10" />} title="No vouchers right now" body="New vouchers drop during campaigns. Check back soon." />
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {rows.map((v) => (
            <VoucherCard key={v.id} v={v} collectable />
          ))}
        </div>
      )}
    </div>
  );
}
