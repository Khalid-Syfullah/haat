import type { Metadata } from 'next';
import { FlashSaleEditor } from '@/components/admin/catalog/flash-sale-editor';

export const metadata: Metadata = { title: 'New flash sale' };

export default function NewFlashSalePage() {
  return <FlashSaleEditor />;
}
