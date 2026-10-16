import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { NewSupportRequestForm, SupportOrderOption } from '@/components/store/support-form';
import { serverApi } from '@/lib/server';

export const metadata: Metadata = { title: 'New help request' };

type Props = { searchParams: Promise<{ order?: string | string[] }> };

export default async function NewSupportRequestPage({ searchParams }: Props) {
  const sp = await searchParams;
  const wanted = (Array.isArray(sp.order) ? sp.order[0] : sp.order)?.trim() || null;
  const [list, categories] = await Promise.all([
    serverApi<{ orders: SupportOrderOption[] }>('/orders'),
    serverApi<{ value: string; label: string }[]>('/support/categories'),
  ]);
  const orders = list?.orders ?? [];

  // An older order linked from its page may not be in the recent list.
  let initialOrder: string | null = null;
  if (wanted) {
    if (orders.some((o) => o.orderNo === wanted)) initialOrder = wanted;
    else {
      const older = await serverApi<SupportOrderOption>(`/orders/${encodeURIComponent(wanted)}`);
      if (older) {
        orders.unshift({ orderNo: older.orderNo, status: older.status, total: older.total, createdAt: older.createdAt, items: older.items });
        initialOrder = older.orderNo;
      }
    }
  }

  return (
    <div className="space-y-3">
      <Link href="/account/support" className="inline-flex items-center gap-1 text-sm text-ink-soft hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> Help and support
      </Link>
      <div>
        <h1 className="text-xl font-bold">New help request</h1>
        <p className="text-[15px] text-ink-soft">Tell us what you need. We reply on this site, and we&apos;ll send you a notification when we do.</p>
      </div>
      <NewSupportRequestForm orders={orders} categories={categories ?? []} initialOrder={initialOrder} />
    </div>
  );
}
