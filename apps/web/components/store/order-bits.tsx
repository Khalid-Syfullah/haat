import { ORDER_STATUS_LABEL } from '@/lib/format';
import { Badge } from '../ui';

export function StatusBadge({ status }: { status: string }) {
  const tone =
    status === 'DELIVERED'
      ? 'green'
      : status === 'CANCELLED' || status === 'DELIVERY_FAILED'
        ? 'red'
        : status === 'AWAITING_PAYMENT' || status === 'PLACED'
          ? 'amber'
          : status === 'SHIPPED'
            ? 'blue'
            : 'neutral';
  return <Badge tone={tone}>{ORDER_STATUS_LABEL[status] ?? status}</Badge>;
}

export interface OrderSummary {
  orderNo: string;
  status: string;
  paymentMethod: string;
  paymentStatus: string;
  total: number;
  createdAt: string;
  expiresAt: string | null;
  items: { id: string; title: string; variantLabel: string | null; imageUrl: string | null; quantity: number; unitPrice: number; reviewed: boolean }[];
}
