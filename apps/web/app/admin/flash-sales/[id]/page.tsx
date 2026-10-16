import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { FlashSaleEditor } from '@/components/admin/catalog/flash-sale-editor';
import { FlashSaleRow } from '@/components/admin/catalog/flash-types';
import { serverApi } from '@/lib/server';

export const metadata: Metadata = { title: 'Edit flash sale' };

export default async function EditFlashSalePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sales = (await serverApi<FlashSaleRow[]>('/admin/flash-sales')) ?? [];
  const sale = sales.find((s) => s.id === id);
  if (!sale) notFound();
  return <FlashSaleEditor key={sale.id} sale={sale} />;
}
