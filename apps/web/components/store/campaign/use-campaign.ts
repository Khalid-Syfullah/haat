'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
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

/** Keyed by campaign and account, so a different account in the same tab never sees someone else's state. */
const meCache = new Map<string, { state: MeState; listeners: Set<() => void>; loading?: Promise<void>; seq: number }>();

function entry(key: string) {
  let e = meCache.get(key);
  if (!e) {
    e = { state: { status: 'loading' }, listeners: new Set(), seq: 0 };
    meCache.set(key, e);
  }
  return e;
}

/** Fetches the shopper's state. Calls made while a request is in flight share it unless `force`; only the latest answer is kept. */
function loadMe(key: string, id: string, force = false) {
  const e = entry(key);
  if (e.loading && !force) return e.loading;
  const seq = ++e.seq;
  const keep = (state: MeState) => {
    if (seq !== e.seq) return;
    e.state = state;
    e.listeners.forEach((l) => l());
  };
  const request = api<CampaignMe>(`/campaigns/${id}/me`)
    .then((me) => keep({ status: 'in', me }))
    // 401 (signed out in the meantime) or a network error: offer to sign in rather than a broken button.
    .catch(() => keep({ status: 'out' }))
    .finally(() => {
      if (e.loading === request) e.loading = undefined;
    });
  e.loading = request;
  return request;
}

/** "YYYY-MM-DD" in Dhaka (UTC+6, no daylight saving), the day the server counts plays by. */
export function dhakaDay(ms: number): string {
  return new Date(ms + 6 * 3_600_000).toISOString().slice(0, 10);
}

/**
 * Whether the shopper is signed in, has collected the voucher and has played today. Skipped in preview,
 * and for signed-out visitors (known from the session, so no request is made for them). Fetched again
 * each time the campaign mounts (the last answer shows meanwhile) and when the Dhaka day rolls over,
 * so a new day's play opens without a reload.
 */
export function useCampaignMe(id: string, enabled: boolean, day: string | null = null) {
  const userId = useSession().user?.id ?? null;
  const key = `${id}:${userId ?? ''}`;
  const state = useSyncExternalStore(
    (cb) => {
      const e = entry(key);
      e.listeners.add(cb);
      return () => e.listeners.delete(cb);
    },
    () => entry(key).state,
    () => ({ status: 'loading' }) as MeState,
  );
  const active = enabled && !!userId;
  useEffect(() => {
    if (active) void loadMe(key, id);
  }, [key, id, active]);
  const seenDay = useRef(day);
  useEffect(() => {
    if (active && day && seenDay.current && seenDay.current !== day) void loadMe(key, id, true);
    if (day) seenDay.current = day;
  }, [key, id, active, day]);
  return {
    state: active ? state : ({ status: 'out' } as MeState),
    refresh: () => loadMe(key, id, true),
    /** Update locally after an action, without another request. */
    patch: (fn: (me: CampaignMe) => CampaignMe) => {
      const e = entry(key);
      if (e.state.status === 'in') {
        e.seq++; // an answer still in flight was asked for before this change, so it's dropped
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
