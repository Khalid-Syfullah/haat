import type { Metadata } from 'next';
import { PrintButton } from '@/components/store/print-button';
import { dateTime, PAYMENT_LABEL, PAYMENT_STATUS_LABEL, tk } from '@/lib/format';
import { mustGet, requireUser, serverApi } from '@/lib/server';

type Props = { params: Promise<{ orderNo: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { orderNo } = await params;
  return { title: `Invoice ${orderNo}`, robots: { index: false } };
}

interface Invoice {
  orderNo: string;
  placedAt: string;
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
  shipLine: string;
  shipArea: string;
  shipDistrict: string;
  shipDivision: string;
  items: { id: string; title: string; variantLabel: string | null; unitPrice: number; quantity: number; lineTotal: number }[];
}

export default async function InvoicePage({ params }: Props) {
  const { orderNo } = await params;
  await requireUser(`/invoice/${orderNo}`);
  const [o, store] = await Promise.all([
    mustGet<Invoice>(`/orders/${orderNo}`),
    serverApi<{ store: { name: string; supportPhone: string; supportEmail: string } }>('/store'),
  ]);
  return (
    <div className="mx-auto max-w-3xl bg-white p-8 text-ink print:p-0">
      <div className="flex items-start justify-between border-b-2 border-padma pb-4">
        <div>
          <p className="font-brand text-4xl leading-none text-padma">হাট</p>
          <p className="mt-1 text-lg font-bold">{store?.store.name ?? 'Haat'}</p>
          <p className="text-sm text-ink-soft">
            {store?.store.supportPhone}, {store?.store.supportEmail}
          </p>
        </div>
        <div className="text-right">
          <h1 className="text-2xl font-bold">Invoice</h1>
          <p className="text-sm">Order {o.orderNo}</p>
          <p className="text-sm text-ink-soft">{dateTime(o.placedAt)}</p>
          <div className="no-print mt-2">
            <PrintButton />
          </div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-6 text-sm">
        <div>
          <p className="mb-1 font-semibold">Deliver to</p>
          <p>{o.shipName}</p>
          <p>{o.shipPhone}</p>
          <p>
            {o.shipLine}, {o.shipArea}, {o.shipDistrict}, {o.shipDivision}
          </p>
        </div>
        <div className="text-right">
          <p className="mb-1 font-semibold">Payment</p>
          <p>{PAYMENT_LABEL[o.paymentMethod]}</p>
          <p>{PAYMENT_STATUS_LABEL[o.paymentStatus]}</p>
        </div>
      </div>

      <table className="mt-6 w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left text-ink-soft">
            <th className="py-2 font-medium">Item</th>
            <th className="py-2 text-right font-medium">Price</th>
            <th className="py-2 text-right font-medium">Qty</th>
            <th className="py-2 text-right font-medium">Amount</th>
          </tr>
        </thead>
        <tbody>
          {o.items.map((i) => (
            <tr key={i.id} className="border-b border-line">
              <td className="py-2 pr-4">
                {i.title}
                {i.variantLabel && <span className="block text-xs text-ink-soft">{i.variantLabel}</span>}
              </td>
              <td className="py-2 text-right tabular-nums">{tk(i.unitPrice)}</td>
              <td className="py-2 text-right tabular-nums">{i.quantity}</td>
              <td className="py-2 text-right tabular-nums">{tk(i.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <dl className="ml-auto mt-4 w-64 space-y-1 text-sm">
        <Line label="Subtotal" value={tk(o.subtotal)} />
        <Line label="Delivery" value={tk(o.shippingFee)} />
        {o.shippingDiscount > 0 && <Line label="Delivery discount" value={`-${tk(o.shippingDiscount)}`} />}
        {o.discount > 0 && <Line label={`Voucher ${o.voucherCode ?? ''}`} value={`-${tk(o.discount)}`} />}
        {o.coinsUsed > 0 && <Line label="Coins" value={`-${tk(o.coinsUsed)}`} />}
        <div className="flex justify-between border-t-2 border-ink pt-1 text-base font-bold">
          <dt>Total</dt>
          <dd>{tk(o.total)}</dd>
        </div>
      </dl>
      <p className="mt-10 text-center text-xs text-ink-faint">Prices include VAT. Thank you for shopping with {store?.store.name ?? 'Haat'}.</p>
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-ink-soft">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
