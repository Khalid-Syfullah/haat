import type { Metadata } from 'next';
import { MockGateway } from '@/components/store/mock-gateway';
import { requireUser } from '@/lib/server';

export const metadata: Metadata = { title: 'Test payment' };

export default async function MockPaymentPage({ searchParams }: { searchParams: Promise<{ session?: string }> }) {
  const { session } = await searchParams;
  await requireUser(`/payment/mock?session=${session ?? ''}`);
  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <MockGateway session={session ?? ''} />
    </div>
  );
}
