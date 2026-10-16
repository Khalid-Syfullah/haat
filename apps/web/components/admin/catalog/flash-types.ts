export interface FlashItemRow {
  id: string;
  variantId: string;
  flashPrice: number;
  quantityLimit: number;
  soldQty: number;
  perUserLimit: number;
  sku: string;
  title: string;
  variantLabel: string | null;
  price: number;
  mrp: number;
  stock: number;
  image: string | null;
}

export interface FlashSaleRow {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
  items: FlashItemRow[];
}
