import { BottomNav } from '@/components/store/bottom-nav';
import { StoreFooter } from '@/components/store/footer';
import { StoreHeader } from '@/components/store/header';
import { serverApi } from '@/lib/server';
import type { CategoryNode } from '@/lib/types';

interface StoreInfo {
  store: { name: string; tagline: string; supportPhone: string; supportEmail: string };
  freeShippingThreshold: number;
}

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const [categories, info] = await Promise.all([serverApi<CategoryNode[]>('/categories'), serverApi<StoreInfo>('/store')]);
  const store = info?.store ?? { name: 'Haat', tagline: '', supportPhone: '', supportEmail: '' };
  return (
    <>
      <StoreHeader categories={categories ?? []} supportPhone={store.supportPhone} freeShippingThreshold={info?.freeShippingThreshold ?? 2000} />
      <main className="min-h-[60vh]">{children}</main>
      <StoreFooter categories={categories ?? []} store={store} />
      <BottomNav />
    </>
  );
}
