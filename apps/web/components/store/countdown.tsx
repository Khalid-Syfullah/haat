'use client';

import clsx from 'clsx';
import { useEffect, useState } from 'react';

function parts(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Live countdown. Renders nothing until mounted so server and client markup match. */
export function Countdown({ to, className, tone = 'dark' }: { to: string; className?: string; tone?: 'dark' | 'light' }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const target = new Date(to).getTime();
  const { d, h, m, s } = parts(now === null ? 0 : target - now);
  const box = clsx('inline-block min-w-[1.9em] rounded px-1 py-0.5 text-center font-bold tabular-nums', tone === 'dark' ? 'bg-ink text-white' : 'bg-white text-ink');
  return (
    <span className={clsx('inline-flex items-center gap-1 text-sm', className)} role="timer" aria-label={now === null ? undefined : `${d} days ${h} hours ${m} minutes left`}>
      {now === null ? (
        <span className="opacity-0">00:00:00</span>
      ) : (
        <>
          {d > 0 && (
            <>
              <span className={box}>{d}d</span>
            </>
          )}
          <span className={box}>{pad(h)}</span>:<span className={box}>{pad(m)}</span>:<span className={box}>{pad(s)}</span>
        </>
      )}
    </span>
  );
}
