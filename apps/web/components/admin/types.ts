/** Shapes returned by the admin API (see apps/api/src/admin/*.controller.ts). */

export interface AdminOrder {
  id: string;
  orderNo: string;
  userId: string;
  status: string;
  paymentMethod: string;
  paymentStatus: string;
  subtotal: number;
  shippingFee: number;
  shippingDiscount: number;
  discount: number;
  coinsUsed: number;
  total: number;
  voucherCode: string | null;
  shipName: string;
  shipPhone: string;
  shipDivision: string;
  shipDistrict: string;
  shipArea: string;
  shipLine: string;
  zone: string;
  zoneLabel: string;
  note: string | null;
  riskScore: number;
  needsCall: boolean;
  courier: string | null;
  trackingNo: string | null;
  expiresAt: string | null;
  cancelReason: string | null;
  createdAt: string;
  items: {
    id: string;
    title: string;
    variantLabel: string | null;
    imageUrl: string | null;
    unitPrice: number;
    originalPrice: number;
    quantity: number;
    lineTotal: number;
    flashSaleItemId: string | null;
    returns: { id: string; status: string; quantity: number }[];
    variant: { sku: string; stock: number; product: { slug: string } };
  }[];
  events: { id: string; status: string | null; title: string; note: string | null; actor: string; createdAt: string }[];
  payments: { id: string; method: string; provider: string; amount: number; status: string; providerTxnId: string | null; createdAt: string }[];
  returns: { id: string; status: string; quantity: number; reason: string; orderItemId: string; createdAt: string }[];
  user: { id: string; name: string; phone: string; email: string | null; codBlocked: boolean; createdAt: string };
  nextStatuses: string[];
  couriers: string[];
  customerHistory: Record<string, number>;
}
