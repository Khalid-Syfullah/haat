import { Heart } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { WishlistRemove } from '@/components/store/account-widgets';
import { ProductCard } from '@/components/store/product-card';
import { EmptyState } from '@/components/ui';
import { serverApi } from '@/lib/server';
import type { ProductCardData } from '@/lib/types';

export const metadata: Metadata = { title: 'Wishlist' };

export default async function WishlistPage() {
  const data = await serverApi<{ items: (ProductCardData & { available: boolean })[] }>('/wishlist');
  const items = data?.items ?? [];
  return (
    <div>
      <h1 className="mb-3 text-xl font-bold">Wishlist ({items.length})</h1>
      {items.length === 0 ? (
        <div className="rounded-[var(--radius-card)] border border-line bg-white">
          <EmptyState
            icon={<Heart className="size-10" />}
            title="Nothing saved yet"
            body="Tap the heart on any product to keep it here for later."
            action={
              <Link href="/" className="font-semibold text-padma hover:underline">
                Browse products
              </Link>
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 xl:grid-cols-4">
          {items.map((p) => (
            <div key={p.id} className="relative">
              <WishlistRemove productId={p.id} />
              <ProductCard p={p} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
