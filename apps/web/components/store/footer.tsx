import Link from 'next/link';
import type { CategoryNode } from '@/lib/types';
import { Logo } from './logo';

export function StoreFooter({ categories, store }: { categories: CategoryNode[]; store: { name: string; tagline: string; supportPhone: string; supportEmail: string } }) {
  return (
    <footer className="no-print mt-12 bg-padma-deep pb-20 text-white/80 md:pb-0">
      <div className="stitch-line opacity-80" />
      <div className="mx-auto grid max-w-[1240px] gap-10 px-4 py-12 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-3 max-w-xs text-[15px]">{store.tagline}.</p>
          <p className="mt-4 text-[15px]">
            Help line <a className="font-semibold text-white" href={`tel:${store.supportPhone}`}>{store.supportPhone}</a>
            <br />
            <a className="text-white hover:underline" href={`mailto:${store.supportEmail}`}>{store.supportEmail}</a>
          </p>
        </div>
        <div>
          <p className="mb-3 font-semibold text-white">Shop</p>
          <ul className="space-y-1.5 text-[15px]">
            {categories.map((c) => (
              <li key={c.id}>
                <Link href={`/category/${c.slug}`} className="hover:text-white">
                  {c.name}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/flash-sale" className="hover:text-white">
                Flash sale
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <p className="mb-3 font-semibold text-white">Your orders</p>
          <ul className="space-y-1.5 text-[15px]">
            <li><Link href="/account/orders" className="hover:text-white">Track an order</Link></li>
            <li><Link href="/account/returns" className="hover:text-white">Returns and refunds</Link></li>
            <li><Link href="/vouchers" className="hover:text-white">Vouchers</Link></li>
            <li><Link href="/account/coins" className="hover:text-white">Tuktak coins</Link></li>
          </ul>
        </div>
        <div>
          <p className="mb-3 font-semibold text-white">Ways to pay</p>
          <div className="flex flex-wrap gap-2 text-sm font-semibold">
            {['Cash on delivery', 'bKash', 'Nagad', 'Rocket', 'Visa', 'Mastercard'].map((m) => (
              <span key={m} className="rounded border border-white/20 px-2 py-1 text-white">
                {m}
              </span>
            ))}
          </div>
          <p className="mt-4 text-sm text-white/60">Delivery in 1–2 days inside Dhaka and 3–5 days across Bangladesh.</p>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-[1240px] flex-wrap justify-between gap-2 px-4 py-4 text-sm text-white/50">
          <span>© {new Date().getFullYear()} {store.name}. Demo store.</span>
          <span>Prices include VAT.</span>
        </div>
      </div>
    </footer>
  );
}
