'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { useSession } from '@/components/providers';
import { api } from '@/lib/api';
import type { CampaignMe } from '@/lib/campaign';

/*
 * Shared client state for the campaign parts (offer strip, banner, game):
 * one corrected clock and one "who am I in this campaign" request, however many parts render.
 */

// ───── Clock ─────
// The page's serverNow can be up to 30 s old (the campaign API is cached), and phone clocks are
// often minutes off, so ask the server once for the time and keep the difference. The health
// endpoint answers with the time and touches no database.

let offset: number | null = null;
let syncing: Promise<void> | null = null;
const clockListeners = new Set<() => void>();

function syncClock(fallbackServerNow: string) {
  if (offset !== null || syncing) return;
  const sent = Date.now();
  syncing = fetch('/api/health', { cache: 'no-store', credentials: 'omit' })
    .then((r) => r.json())
    .then((d: { time?: string }) => {
      const received = Date.now();
      if (!d.time) throw new Error('no time');
      offset = Date.parse(d.time) + (received - sent) / 2 - received;
    })
    .catch(() => {
      offset = Date.parse(fallbackServerNow) - Date.now();
    })
    .finally(() => clockListeners.forEach((l) => l()));
}

/**
 * Current server time in ms, ticking every second while the tab is visible. null until the clock is known
 * (render nothing time-dependent until then). In preview, the clock starts at `serverNow` exactly.
 */
export function useServerNow(serverNow: string, preview = false): number | null {
  const [previewOffset, setPreviewOffset] = useState<number | null>(null);
  const [now, setNow] = useState<number | null>(null);
  const known = useSyncExternalStore(
    (cb) => {
      clockListeners.add(cb);
      return () => clockListeners.delete(cb);
    },
    () => offset !== null,
    () => false,
  );

  useEffect(() => {
    if (preview) setPreviewOffset(Date.parse(serverNow) - Date.now());
    else syncClock(serverNow);
  }, [serverNow, preview]);

  const active = preview ? previewOffset : known ? offset : null;

  useEffect(() => {
    if (active === null) return;
    let timer: ReturnType<typeof setInterval> | undefined;
    const tick = () => setNow(Date.now() + active);
    const start = () => {
      tick();
      clearInterval(timer);
      timer = setInterval(tick, 1000);
    };
    const onVisibility = () => (document.hidden ? clearInterval(timer) : start());
    start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [active]);

  return active === null ? null : now;
}

/** TEASER before the start, LIVE until the end, ENDED after. */
export function phaseAt(now: number, startsAt: string, endsAt: string): 'TEASER' | 'LIVE' | 'ENDED' {
  if (now >= Date.parse(endsAt)) return 'ENDED';
  return now >= Date.parse(startsAt) ? 'LIVE' : 'TEASER';
}

// ───── The shopper's own state ─────

type MeState = { status: 'loading' } | { status: 'out' } | { status: 'in'; me: CampaignMe };

const meCache = new Map<string, { state: MeState; listeners: Set<() => void>; loading?: Promise<void> }>();

function entry(id: string) {
  let e = meCache.get(id);
  if (!e) {
    e = { state: { status: 'loading' }, listeners: new Set() };
    meCache.set(id, e);
  }
  return e;
}

function loadMe(id: string, force = false) {
  const e = entry(id);
  if (e.loading && !force) return e.loading;
  e.loading = api<CampaignMe>(`/campaigns/${id}/me`)
    .then((me) => {
      e.state = { status: 'in', me };
    })
    .catch(() => {
      // 401 (signed out in the meantime) or a network error: offer to sign in rather than a broken button.
      e.state = { status: 'out' };
    })
    .finally(() => e.listeners.forEach((l) => l()));
  return e.loading;
}

/**
 * Whether the shopper is signed in, has collected the voucher and has played today. Skipped in preview,
 * and for signed-out visitors (known from the session, so no request is made for them).
 */
export function useCampaignMe(id: string, enabled: boolean) {
  const signedIn = !!useSession().user;
  const state = useSyncExternalStore(
    (cb) => {
      const e = entry(id);
      e.listeners.add(cb);
      return () => e.listeners.delete(cb);
    },
    () => entry(id).state,
    () => ({ status: 'loading' }) as MeState,
  );
  const active = enabled && signedIn;
  useEffect(() => {
    if (active) void loadMe(id);
  }, [id, active]);
  return {
    state: active ? state : ({ status: 'out' } as MeState),
    refresh: () => loadMe(id, true),
    /** Update locally after an action, without another request. */
    patch: (fn: (me: CampaignMe) => CampaignMe) => {
      const e = entry(id);
      if (e.state.status === 'in') {
        e.state = { status: 'in', me: fn(e.state.me) };
        e.listeners.forEach((l) => l());
      }
    },
  };
}

/** True when the visitor asked the system for less motion. */
export function useReducedMotion() {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
      mq.addEventListener('change', cb);
      return () => mq.removeEventListener('change', cb);
    },
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    () => false,
  );
}
