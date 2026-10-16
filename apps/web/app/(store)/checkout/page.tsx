import type { Metadata } from 'next';
import { CheckoutView } from '@/components/store/checkout-view';
import { requireUser, serverApi } from '@/lib/server';
import type { Address } from '@/lib/types';

export const metadata: Metadata = { title: 'Checkout' };

type Props = { searchParams: Promise<{ buyNow?: string; qty?: string }> };

export default async function CheckoutPage({ searchParams }: Props) {
  const sp = await searchParams;
  const next = sp.buyNow ? `/checkout?buyNow=${sp.buyNow}&qty=${sp.qty ?? 1}` : '/checkout';
  const me = await requireUser(next);
  const addresses = (await serverApi<Address[]>('/account/addresses')) ?? [];
  const buyNow = sp.buyNow ? { variantId: sp.buyNow, quantity: Math.max(1, Math.min(10, Number(sp.qty) || 1)) } : null;
  return (
    <div className="mx-auto max-w-[1240px] px-3 py-4 sm:px-4 sm:py-6">
      <h1 className="mb-4 text-2xl font-bold">Checkout</h1>
      <CheckoutView addresses={addresses} buyNow={buyNow} user={{ name: me.user!.name, phone: me.user!.phone }} />
    </div>
  );
}
