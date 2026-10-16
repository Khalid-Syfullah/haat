'use client';

import clsx from 'clsx';
import { Bell, Coins, Heart, House, MapPin, MessageSquare, Package, Ticket, Undo2, UserRound } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from '../providers';

const LINKS = [
  { href: '/account', label: 'Overview', icon: House },
  { href: '/account/orders', label: 'My orders', icon: Package },
  { href: '/account/returns', label: 'Returns', icon: Undo2 },
  { href: '/account/reviews', label: 'Reviews', icon: MessageSquare },
  { href: '/account/wishlist', label: 'Wishlist', icon: Heart },
  { href: '/account/vouchers', label: 'Vouchers', icon: Ticket },
  { href: '/account/coins', label: 'Coins', icon: Coins },
  { href: '/account/addresses', label: 'Addresses', icon: MapPin },
  { href: '/account/notifications', label: 'Notifications', icon: Bell },
  { href: '/account/profile', label: 'Profile', icon: UserRound },
];

export function AccountNav() {
  const pathname = usePathname();
  const { user, unread } = useSession();
  const active = (href: string) => (href === '/account' ? pathname === href : pathname.startsWith(href));
  return (
    <nav aria-label="Account" className="min-w-0">
      <div className="mb-3 hidden rounded-[var(--radius-card)] border border-line bg-white p-4 lg:block">
        <p className="text-sm text-ink-soft">Signed in as</p>
        <p className="font-semibold">{user?.name}</p>
        <p className="text-sm text-ink-soft">{user?.phone}</p>
      </div>
      <ul className="no-scrollbar -mx-3 flex gap-1 overflow-x-auto px-3 lg:mx-0 lg:flex-col lg:rounded-[var(--radius-card)] lg:border lg:border-line lg:bg-white lg:p-2">
        {LINKS.map(({ href, label, icon: Icon }) => (
          <li key={href} className="shrink-0">
            <Link
              href={href}
              aria-current={active(href) ? 'page' : undefined}
              className={clsx(
                'flex items-center gap-2.5 rounded-md px-3 py-2 text-[15px] font-medium',
                active(href) ? 'bg-padma-tint text-padma-dark' : 'text-ink-soft hover:bg-paper hover:text-ink max-lg:bg-white',
              )}
            >
              <Icon className="size-[18px]" />
              {label}
              {label === 'Notifications' && unread > 0 && <span className="rounded-full bg-sindoor px-1.5 text-xs font-bold leading-5 text-white">{unread}</span>}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
