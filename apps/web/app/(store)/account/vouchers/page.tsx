import { Ticket } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { VoucherCard, VoucherCardData } from '@/components/store/account-widgets';
import { EmptyState } from '@/components/ui';
import { serverApi } from '@/lib/server';

export const metadata: Metadata = { title: 'My vouchers' };

export default async function MyVouchersPage() {
  const rows = (await serverApi<VoucherCardData[]>('/vouchers/mine')) ?? [];
  const order = { available: 0, used: 1, expired: 2 };
  rows.sort((a, b) => order[a.state ?? 'available'] - order[b.state ?? 'available']);
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-xl font-bold">My vouchers</h1>
        <Link href="/vouchers" className="text-[15px] font-semibold text-padma hover:underline">
          Collect more
        </Link>
      </div>
      {rows.length === 0 ? (
        <div className="rounded-[var(--radius-card)] border border-line bg-white">
          <EmptyState icon={<Ticket className="size-10" />} title="No vouchers collected" body="Collect store vouchers and they'll be ready to pick at checkout." />
        </div>
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          {rows.map((v) => (
            <VoucherCard key={v.id} v={v} />
          ))}
        </div>
      )}
    </div>
  );
}
