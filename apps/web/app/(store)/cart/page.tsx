import type { Metadata } from 'next';
import { CartView } from '@/components/store/cart-view';
import { requireUser, serverApi } from '@/lib/server';

export const metadata: Metadata = { title: 'Your cart' };

export default async function CartPage() {
  await requireUser('/cart');
  const [cart, store] = await Promise.all([serverApi('/cart'), serverApi<{ freeShippingThreshold: number }>('/store')]);
  return (
    <div className="mx-auto max-w-[1240px] px-3 py-4 sm:px-4 sm:py-6">
      <h1 className="mb-4 text-2xl font-bold">Your cart</h1>
      <CartView initial={cart} freeShippingThreshold={store?.freeShippingThreshold ?? 2000} />
    </div>
  );
}
