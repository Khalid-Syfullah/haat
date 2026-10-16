'use client';

import clsx from 'clsx';
import {
  BadgePercent,
  ChartColumn,
  ClipboardList,
  Image as ImageIcon,
  Layers,
  LogOut,
  Menu,
  MessageCircleQuestion,
  MessageSquare,
  Package,
  Settings,
  Store,
  Tags,
  Undo2,
  Users,
  Warehouse,
  X,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ReactNode, useState } from 'react';
import { post } from '@/lib/api';

const NAV: { group: string; items: { href: string; label: string; icon: typeof Package }[] }[] = [
  { group: 'Sales', items: [
    { href: '/admin', label: 'Dashboard', icon: ChartColumn },
    { href: '/admin/orders', label: 'Orders', icon: ClipboardList },
    { href: '/admin/returns', label: 'Returns', icon: Undo2 },
    { href: '/admin/customers', label: 'Customers', icon: Users },
  ] },
  { group: 'Catalog', items: [
    { href: '/admin/products', label: 'Products', icon: Package },
    { href: '/admin/inventory', label: 'Inventory', icon: Warehouse },
    { href: '/admin/categories', label: 'Categories', icon: Layers },
    { href: '/admin/brands', label: 'Brands', icon: Tags },
  ] },
  { group: 'Marketing', items: [
    { href: '/admin/flash-sales', label: 'Flash sales', icon: Zap },
    { href: '/admin/vouchers', label: 'Vouchers', icon: BadgePercent },
    { href: '/admin/banners', label: 'Banners', icon: ImageIcon },
  ] },
  { group: 'Customer care', items: [
    { href: '/admin/reviews', label: 'Reviews', icon: MessageSquare },
    { href: '/admin/questions', label: 'Questions', icon: MessageCircleQuestion },
  ] },
  { group: 'Store', items: [{ href: '/admin/settings', label: 'Settings', icon: Settings }] },
];

export function AdminShell({ name, storeName, children }: { name: string; storeName: string; children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const active = (href: string) => (href === '/admin' ? pathname === '/admin' : pathname.startsWith(href));

  const nav = (
    <nav className="flex flex-col gap-5 px-3 py-4" aria-label="Admin">
      {NAV.map((g) => (
        <div key={g.group}>
          <p className="px-3 pb-1 text-xs font-medium text-white/50">{g.group}</p>
          {g.items.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className={clsx(
                'flex items-center gap-3 rounded-md px-3 py-2 text-[15px] font-medium',
                active(href) ? 'bg-white/12 text-white' : 'text-white/75 hover:bg-white/8 hover:text-white',
              )}
              aria-current={active(href) ? 'page' : undefined}
            >
              <Icon className={clsx('size-[18px]', active(href) && 'text-marigold')} />
              {label}
            </Link>
          ))}
        </div>
      ))}
    </nav>
  );

  return (
    <div className="min-h-dvh bg-paper lg:pl-60 print:bg-white print:pl-0">
      <aside
        className={clsx(
          'no-print fixed inset-y-0 left-0 z-40 w-60 overflow-y-auto bg-padma-deep transition-transform lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-14 items-center justify-between border-b border-white/10 px-5">
          <Link href="/admin" className="flex items-baseline gap-2 text-white">
            <span className="font-brand text-2xl leading-none">হাট</span>
            <span className="text-sm font-semibold text-white/70">{storeName} admin</span>
          </Link>
          <button className="text-white/70 lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu">
            <X className="size-5" />
          </button>
        </div>
        {nav}
      </aside>
      {open && <div className="no-print fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setOpen(false)} />}

      <header className="no-print sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-line bg-white px-4 lg:px-8">
        <button className="text-ink-soft lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
          <Menu className="size-6" />
        </button>
        <div className="ml-auto flex items-center gap-4 text-sm">
          <Link href="/" className="inline-flex items-center gap-1.5 text-ink-soft hover:text-ink" target="_blank">
            <Store className="size-4" /> View store
          </Link>
          <span className="hidden text-ink-soft sm:inline">{name}</span>
          <button
            className="inline-flex items-center gap-1.5 text-ink-soft hover:text-sindoor"
            onClick={async () => {
              await post('/auth/logout');
              router.push('/login');
              router.refresh();
            }}
          >
            <LogOut className="size-4" /> Log out
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-[1400px] px-4 py-6 lg:px-8 print:max-w-none print:p-0">{children}</main>
    </div>
  );
}

/** Page title row used by every admin page. */
export function AdminHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-ink">{title}</h1>
        {description && <p className="mt-0.5 text-ink-soft">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
