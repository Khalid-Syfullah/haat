'use client';

import { Coins, Package, Ticket, Truck } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { ApiError, post } from '@/lib/api';
import { useSession, useToast } from '../providers';
import { Button } from '../ui';

/** The panel beside the hero: who you are, your coins, and where your orders are. */
export function HomeSide() {
  const { user, refresh } = useSession();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function checkIn() {
    setBusy(true);
    try {
      const res = await post<{ earned: number; balance: number }>('/coins/check-in');
      toast(`You earned ${res.earned} coins. Balance: ${res.balance}`);
      await refresh();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Could not check in', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <aside className="hidden flex-col rounded-[var(--radius-card)] border border-line bg-white p-4 lg:flex">
      {user ? (
        <>
          <p className="text-sm text-ink-soft">Welcome back</p>
          <p className="text-lg font-semibold">{user.name}</p>
          <div className="mt-3 flex items-center justify-between rounded-md bg-marigold-tint px-3 py-2.5">
            <span className="flex items-center gap-2 text-[15px]">
              <Coins className="size-5 text-marigold-dark" />
              <span>
                <span className="font-bold">{user.coins}</span> coins
              </span>
            </span>
            <Button size="sm" variant="deal" onClick={checkIn} loading={busy}>
              Check in
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="text-lg font-semibold">Shop smarter with an account</p>
          <p className="mt-1 text-[15px] text-ink-soft">Track orders, collect vouchers and earn coins every day.</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Link href="/login" className="rounded-md bg-padma py-2 text-center font-semibold text-white hover:bg-padma-dark">
              Log in
            </Link>
            <Link href="/register" className="rounded-md border border-line py-2 text-center font-semibold hover:border-ink-faint">
              Sign up
            </Link>
          </div>
        </>
      )}
      <ul className="mt-4 flex-1 divide-y divide-line text-[15px]">
        {[
          { href: '/account/orders', icon: Package, label: 'Track my orders' },
          { href: '/vouchers', icon: Ticket, label: 'Collect vouchers' },
          { href: '/account/coins', icon: Coins, label: 'Pay with coins' },
          { href: '/account/returns', icon: Truck, label: 'Easy 7-day returns' },
        ].map(({ href, icon: Icon, label }) => (
          <li key={href}>
            <Link href={href} className="flex items-center gap-3 py-2.5 hover:text-padma">
              <Icon className="size-[18px] text-padma" />
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </aside>
  );
}
