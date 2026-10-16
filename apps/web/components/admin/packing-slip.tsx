import { dateTime, tk } from '@/lib/format';
import type { AdminOrder } from './types';

/** Hidden on screen; this is what "Print packing slip" prints. */
export function PackingSlip({ order: o, storeName, supportPhone }: { order: AdminOrder; storeName: string; supportPhone: string }) {
  const codDue = o.paymentMethod === 'COD' && o.paymentStatus !== 'PAID';
  const units = o.items.reduce((s, i) => s + i.quantity, 0);
  return (
    <div className="hidden text-[13px] leading-snug text-black print:block">
      <div className="flex items-start justify-between border-b-2 border-black pb-3">
        <div>
          <p className="text-xl font-bold">{storeName}</p>
          <p>Packing slip{supportPhone ? `, help line ${supportPhone}` : ''}</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold">{o.orderNo}</p>
          <p>Placed {dateTime(o.createdAt)}</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-6">
        <div>
          <p className="text-xs font-semibold">Deliver to</p>
          <p className="text-base font-bold">{o.shipName}</p>
          <p className="text-base">{o.shipPhone}</p>
          <p>{o.shipLine}</p>
          <p>
            {o.shipArea}, {o.shipDistrict}
          </p>
          <p>{o.shipDivision} division</p>
          <p className="mt-1">{o.zoneLabel}</p>
        </div>
        <div className="text-right">
          <p className="text-xs font-semibold">{codDue ? 'Collect cash on delivery' : 'Payment'}</p>
          <p className="text-2xl font-bold">{codDue ? tk(o.total) : 'Paid, collect nothing'}</p>
          {o.courier && (
            <p className="mt-2">
              {o.courier}, tracking {o.trackingNo}
            </p>
          )}
        </div>
      </div>

      <table className="mt-5 w-full border-collapse">
        <thead>
          <tr className="border-b border-black text-left">
            <th className="py-1.5 pr-2">Item</th>
            <th className="py-1.5 pr-2">SKU</th>
            <th className="py-1.5 pr-2 text-right">Qty</th>
            <th className="py-1.5 pr-2 text-right">Price</th>
            <th className="w-10 py-1.5 text-center">Packed</th>
          </tr>
        </thead>
        <tbody>
          {o.items.map((i) => (
            <tr key={i.id} className="border-b border-black/30">
              <td className="py-1.5 pr-2">
                {i.title}
                {i.variantLabel ? `, ${i.variantLabel}` : ''}
              </td>
              <td className="py-1.5 pr-2 font-mono">{i.variant.sku}</td>
              <td className="py-1.5 pr-2 text-right text-base font-bold">{i.quantity}</td>
              <td className="py-1.5 pr-2 text-right">{tk(i.lineTotal)}</td>
              <td className="py-1.5 text-center">
                <span className="inline-block size-4 border border-black" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-3 ml-auto w-64">
        <p className="flex justify-between">
          <span>Subtotal</span>
          <span>{tk(o.subtotal)}</span>
        </p>
        <p className="flex justify-between">
          <span>Delivery</span>
          <span>{tk(o.shippingFee - o.shippingDiscount)}</span>
        </p>
        {o.discount + o.coinsUsed > 0 && (
          <p className="flex justify-between">
            <span>Discounts and coins</span>
            <span>−{tk(o.discount + o.coinsUsed)}</span>
          </p>
        )}
        <p className="mt-1 flex justify-between border-t border-black pt-1 text-base font-bold">
          <span>Total</span>
          <span>{tk(o.total)}</span>
        </p>
      </div>

      <p className="mt-4">{units} item{units === 1 ? '' : 's'} in this parcel.</p>
      {o.note && <p className="mt-2">Customer note: {o.note}</p>}
      <p className="mt-6 text-xs">Thank you for shopping with {storeName}.</p>
    </div>
  );
}
