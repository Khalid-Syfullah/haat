'use client';

import clsx from 'clsx';
import type { CampaignView, CurrentCampaign } from '@/lib/campaign';
import { CampaignBanner } from './campaign-banner';
import { DailyGame } from './daily-game';
import { DealCards } from './deal-cards';
import { phaseAt, useCampaignMe, useServerNow } from './use-campaign';

/**
 * The campaign block on the home page (banner, deal cards, daily game), right before "Shop by category".
 * The server renders it with the page; the countdown, confetti, game and the shopper's own state take
 * over in the browser. When the teaser ends it turns live, and when the campaign ends it disappears,
 * without a reload. `preview` is for Admin → Campaigns: no account calls, the clock starts at
 * `data.serverNow`, and confetti plays every time.
 */
export function CampaignBlock({ data, preview = false }: { data: CurrentCampaign; preview?: boolean }) {
  if (!data.campaign) return null;
  return <Block key={`${data.campaign.id}-${preview ? data.serverNow : ''}`} c={data.campaign} serverNow={data.serverNow} preview={preview} />;
}

function Block({ c, serverNow, preview }: { c: CampaignView; serverNow: string; preview: boolean }) {
  const now = useServerNow(serverNow, preview);
  const me = useCampaignMe(c.id, !preview);
  const phase = now === null ? c.status : phaseAt(now, c.startsAt, c.endsAt);
  if (phase === 'ENDED') return null;
  const showDeals = phase === 'LIVE' && c.deals.length > 0;
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
