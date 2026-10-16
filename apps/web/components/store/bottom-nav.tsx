'use client';

import clsx from 'clsx';
import { House, LayoutGrid, ShoppingCart, User } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from '../providers';

/** Phone-only tab bar, like the shopping apps people already use. */
export function BottomNav() {
  const pathname = usePathname();
  const { cartCount, user } = useSession();
  const tabs = [
    { href: '/', label: 'Home', icon: House, match: (p: string) => p === '/' },
    { href: '/categories', label: 'Categories', icon: LayoutGrid, match: (p: string) => p.startsWith('/categor') },
    { href: '/cart', label: 'Cart', icon: ShoppingCart, match: (p: string) => p.startsWith('/cart') },
    { href: user ? '/account' : '/login', label: user ? 'Account' : 'Log in', icon: User, match: (p: string) => p.startsWith('/account') || p === '/login' },
  ];
  if (pathname.startsWith('/checkout') || pathname.startsWith('/payment')) return null;
  return (
    <nav className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white pb-[env(safe-area-inset-bottom)] md:hidden" aria-label="Main">
      <div className="grid grid-cols-4">
        {tabs.map(({ href, label, icon: Icon, match }) => {
          const active = match(pathname);
          return (
            <Link key={label} href={href} className={clsx('relative flex flex-col items-center gap-0.5 py-2 text-xs font-medium', active ? 'text-padma' : 'text-ink-soft')}>
              <Icon className="size-6" strokeWidth={active ? 2.4 : 1.8} />
              {label}
              {label === 'Cart' && cartCount > 0 && (
                <span className="absolute left-1/2 top-1 ml-2 min-w-[18px] rounded-full bg-sindoor px-1 text-center text-[11px] font-bold leading-[18px] text-white">{cartCount}</span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
