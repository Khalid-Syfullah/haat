'use client';

import clsx from 'clsx';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { CampaignView, CurrentCampaign } from '@/lib/campaign';
import { CampaignBanner } from './campaign-banner';
import { DailyGame } from './daily-game';
import { DealCards } from './deal-cards';
import { dhakaDay, phaseAt, useCampaignMe, useServerNow } from './use-campaign';

/**
 * The campaign block on the home page (banner, deal cards, daily game), right before "Shop by category".
 * The server renders it with the page; the countdown, confetti, game and the shopper's own state take
 * over in the browser. When the teaser ends it turns live, and when the campaign ends it disappears,
 * without a reload. `preview` is for Admin → Campaigns: no account calls, the clock starts at
 * `data.serverNow`, and confetti plays every time.
 */
export function CampaignBlock({ data, preview = false }: { data: CurrentCampaign; preview?: boolean }) {
  if (!data.campaign) return null;
  return <Block key={`${data.campaign.id}-${preview ? data.serverNow : ''}`} initial={data.campaign} serverNow={data.serverNow} preview={preview} />;
}

function Block({ initial, serverNow, preview }: { initial: CampaignView; serverNow: string; preview: boolean }) {
  const now = useServerNow(serverNow, preview);
  const phase = now === null ? initial.status : phaseAt(now, initial.startsAt, initial.endsAt);
  const fresh = useLiveCampaign(initial, phase === 'LIVE' && initial.status === 'TEASER' && !preview);
  const c = fresh ?? initial;
  const me = useCampaignMe(c.id, !preview, now === null ? null : dhakaDay(now));
  if (phase === 'ENDED') return null;
  // Deals priced during the teaser can be out of date once it's live, so they wait for live data.
  const liveData = initial.status === 'LIVE' || preview || fresh !== null;
  const showDeals = phase === 'LIVE' && liveData && c.deals.length > 0;
  const showGame = phase === 'LIVE' && !!c.game && c.game.rewards.length > 0;
  return (
    <section id="campaign" aria-label={c.title} lang="bn" className="scroll-mt-28 space-y-3">
      <CampaignBanner c={c} phase={phase} now={now} preview={preview} me={me} />
      {(showDeals || showGame) && (
        <div className={clsx('grid gap-3', showDeals && showGame && 'lg:grid-cols-[minmax(0,1fr)_300px]')}>
          {showDeals && <DealCards deals={c.deals} preview={preview} />}
          {showGame && <DailyGame c={c} preview={preview} me={me} />}
        </div>
      )}
    </section>
  );
}

const ATTEMPTS = 5;
const RETRY_MS = 2000;

/**
 * A page opened during the teaser holds the campaign as it was then: a linked flash sale wasn't running,
 * so its deals carry regular prices, and the voucher may not have been collectible yet. When the
 * teaser turns live, fetch the campaign again. The device clock is synced to the server's but can be
 * a moment early, so an answer that is still a teaser is retried a few times.
 */
function useLiveCampaign(initial: CampaignView, turnedLive: boolean): CampaignView | null {
  const [fresh, setFresh] = useState<CampaignView | null>(null);
  useEffect(() => {
    if (!turnedLive) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const retry = (n: number) => {
      if (!cancelled && n < ATTEMPTS) timer = setTimeout(() => attempt(n + 1), RETRY_MS);
    };
    const attempt = (n: number) => {
      api<CurrentCampaign>('/campaigns/current', { cache: 'no-store' })
        .then((d) => {
          if (cancelled) return;
          if (d.campaign?.id === initial.id && d.campaign.status === 'LIVE') setFresh(d.campaign);
          else retry(n);
        })
        .catch(() => retry(n));
    };
    attempt(1);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [turnedLive, initial.id]);
  return fresh;
}
