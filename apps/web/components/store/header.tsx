'use client';

import clsx from 'clsx';
import { Bell, ChevronDown, Heart, LogOut, Package, ShoppingCart, User, Zap } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import { post } from '@/lib/api';
import type { CategoryNode } from '@/lib/types';
import { useSession } from '../providers';
import { Logo } from './logo';
import { SearchBox } from './search-box';

function AccountMenu() {
  const { user, unread, refresh } = useSession();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  if (!user) {
    return (
      <div className="flex items-center gap-1 text-[15px] font-medium text-white">
        <Link href="/login" className="rounded px-2 py-1 hover:bg-white/10">
          Log in
        </Link>
        <span className="text-white/40">|</span>
        <Link href="/register" className="rounded px-2 py-1 hover:bg-white/10">
          Sign up
        </Link>
      </div>
    );
  }

  const first = user.name.split(' ')[0];
  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-white hover:bg-white/10"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className="relative">
          <User className="size-6" />
          {unread > 0 && <span className="absolute -right-1 -top-1 size-2.5 rounded-full bg-marigold ring-2 ring-padma" aria-label={`${unread} unread notifications`} />}
        </span>
        <span className="hidden leading-tight lg:block">
          <span className="block text-xs text-white/70">Hello, {first}</span>
          <span className="flex items-center text-[15px] font-semibold">
            Account <ChevronDown className="size-4" />
          </span>
        </span>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-12 z-50 w-56 overflow-hidden rounded-md border border-line bg-white py-1 text-[15px] text-ink shadow-lg">
          {user.role === 'ADMIN' && (
            <Link role="menuitem" href="/admin" className="block px-4 py-2 font-semibold text-padma hover:bg-paper" onClick={() => setOpen(false)}>
              Store admin
            </Link>
          )}
          {[
            { href: '/account', label: 'My account', icon: User },
            { href: '/account/orders', label: 'My orders', icon: Package },
            { href: '/account/wishlist', label: 'Wishlist', icon: Heart },
            { href: '/account/notifications', label: unread ? `Notifications (${unread})` : 'Notifications', icon: Bell },
          ].map(({ href, label, icon: Icon }) => (
            <Link key={href} role="menuitem" href={href} className="flex items-center gap-3 px-4 py-2 hover:bg-paper" onClick={() => setOpen(false)}>
              <Icon className="size-4 text-ink-soft" /> {label}
            </Link>
          ))}
          <button
            role="menuitem"
            className="flex w-full items-center gap-3 border-t border-line px-4 py-2 text-left hover:bg-paper"
            onClick={async () => {
              await post('/auth/logout');
              setOpen(false);
              await refresh();
              router.push('/');
              router.refresh();
            }}
          >
            <LogOut className="size-4 text-ink-soft" /> Log out
          </button>
        </div>
      )}
    </div>
  );
}

function CartLink() {
  const { cartCount } = useSession();
  return (
    <Link href="/cart" className="relative flex items-center gap-2 rounded-md px-2 py-1.5 text-white hover:bg-white/10" aria-label={`Cart, ${cartCount} items`}>
      <ShoppingCart className="size-6" />
      {cartCount > 0 && (
        <span className="absolute left-5 top-0 min-w-5 rounded-full bg-marigold px-1 text-center text-xs font-bold leading-5 text-ink">{cartCount}</span>
      )}
      <span className="hidden text-[15px] font-semibold lg:inline">Cart</span>
    </Link>
  );
}

export function StoreHeader({ categories, supportPhone, freeShippingThreshold }: { categories: CategoryNode[]; supportPhone: string; freeShippingThreshold: number }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className="no-print sticky top-0 z-40">
      <div className="hidden bg-padma-deep text-[13px] text-white/80 md:block">
        <div className="mx-auto flex h-8 max-w-[1240px] items-center gap-6 px-4">
          <span>Cash on delivery in all 64 districts</span>
          <span>Free delivery on orders over ৳{freeShippingThreshold.toLocaleString('en-IN')}</span>
          <span>Pay with bKash, Nagad or card</span>
          <span className="ml-auto">Help line {supportPhone}</span>
        </div>
      </div>
      <div className={clsx('bg-padma transition-shadow', scrolled && 'shadow-md')}>
        <div className="mx-auto flex max-w-[1240px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 md:flex-nowrap md:py-3">
          <Logo />
          <Suspense fallback={<div className="order-last h-11 w-full md:order-none md:flex-1" />}>
            <SearchBox className="order-last w-full md:order-none md:flex-1" />
          </Suspense>
          <nav className="ml-auto flex items-center gap-1 md:ml-0">
            <AccountMenu />
            <CartLink />
          </nav>
        </div>
      </div>
      <nav className="hidden border-b border-line bg-white md:block" aria-label="Categories">
        <div className="no-scrollbar mx-auto flex max-w-[1240px] items-center gap-1 overflow-x-auto px-4 text-[15px]">
          <Link href="/flash-sale" className="flex shrink-0 items-center gap-1.5 py-2.5 pr-3 font-semibold text-sindoor">
            <Zap className="size-4 fill-marigold text-marigold" /> Flash sale
          </Link>
          {categories.map((c) => (
            <div key={c.id} className="group relative shrink-0">
              <Link href={`/category/${c.slug}`} className="block rounded px-3 py-2.5 font-medium text-ink hover:text-padma">
                {c.name}
              </Link>
              {c.children.length > 0 && (
                <div className="invisible absolute left-0 top-full z-50 w-60 rounded-b-md border border-line bg-white py-2 opacity-0 shadow-lg transition-opacity group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
                  {c.children.map((child) => (
                    <Link key={child.id} href={`/category/${child.slug}`} className="flex items-baseline justify-between px-4 py-1.5 hover:bg-paper">
                      <span>{child.name}</span>
                      {child.nameBn && <span className="text-sm text-ink-faint">{child.nameBn}</span>}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
          <Link href="/vouchers" className="ml-auto shrink-0 py-2.5 pl-3 font-medium text-padma hover:underline">
            Vouchers
          </Link>
        </div>
      </nav>
    </header>
  );
}
