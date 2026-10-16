'use client';

import { KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import { tk } from '@/lib/format';

interface Day {
  day: string; // YYYY-MM-DD (Dhaka)
  orders: number;
  revenue: number;
}

const H = 300;
const PAD = { top: 22, right: 8, bottom: 26, left: 52 };

// Formatted by hand: server and browser ICU data disagree on short month names ("Sep" / "Sept"),
// which would break hydration.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const label = (d: string) => `${Number(d.slice(8, 10))} ${MONTHS[Number(d.slice(5, 7)) - 1]}`;
const longLabel = (d: string) => `${WEEKDAYS[new Date(`${d}T00:00:00Z`).getUTCDay()]} ${label(d)}`;

/** ৳0, ৳40k, ৳1.2L: compact taka for axis ticks. */
function compactTk(n: number) {
  if (n >= 100000) return `৳${(n / 100000).toFixed(n % 100000 === 0 ? 0 : 1)}L`;
  if (n >= 1000) return `৳${Math.round(n / 1000)}k`;
  return `৳${n}`;
}

/** Clean tick step: 1, 2, 2.5 or 5 times a power of ten. */
function niceMax(max: number) {
  if (max <= 0) return { top: 1000, step: 250 };
  const rough = max / 4;
  const pow = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= rough) ?? 10 * pow;
  return { top: Math.ceil(max / step) * step, step };
}

/** Column with a 4px rounded data end and a square base. */
function barPath(x: number, y: number, w: number, h: number) {
  if (h <= 0) return '';
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

export function RevenueChart({ days }: { days: Day[] }) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(720);
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(280, Math.floor(entry.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { top, step } = useMemo(() => niceMax(Math.max(...days.map((d) => d.revenue), 0)), [days]);
  const peak = useMemo(() => days.reduce((best, d, i) => (d.revenue > (days[best]?.revenue ?? -1) ? i : best), 0), [days]);

  const innerW = width - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const slot = innerW / days.length;
  const barW = Math.max(3, Math.min(24, slot - 2));
  const y = (v: number) => PAD.top + innerH - (v / top) * innerH;
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
  const labelEvery = width < 480 ? 7 : width < 760 ? 5 : 3;

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      setActive((a) => {
        const cur = a ?? days.length - 1;
        return Math.max(0, Math.min(days.length - 1, cur + (e.key === 'ArrowRight' ? 1 : -1)));
      });
    } else if (e.key === 'Escape') setActive(null);
  };

  const a = active !== null ? days[active] : null;
  const tipX = active !== null ? PAD.left + slot * active + slot / 2 : 0;

  return (
    <div>
      <div ref={box} className="relative" onPointerLeave={() => setActive(null)}>
        <svg
          width={width}
          height={H}
          role="img"
          aria-label={`Daily revenue for the last 30 days. Highest: ${tk(days[peak]?.revenue)} on ${days[peak] ? longLabel(days[peak].day) : ''}. Use the left and right arrow keys to read each day.`}
          tabIndex={0}
          onKeyDown={onKey}
          onFocus={() => setActive((v) => v ?? days.length - 1)}
          onBlur={() => setActive(null)}
          className="block rounded focus-visible:outline-2 focus-visible:outline-marigold"
        >
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} stroke="#e2e6e3" strokeWidth={1} shapeRendering="crispEdges" />
              <text x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-ink-faint text-[11px] tabular-nums">
                {compactTk(t)}
              </text>
            </g>
          ))}
          {days.map((d, i) => {
            const cx = PAD.left + slot * i + slot / 2;
            const h = (d.revenue / top) * innerH;
            const isToday = i === days.length - 1;
            const showLabel = isToday || (days.length - 1 - i) % labelEvery === 0;
            return (
              <g key={d.day}>
                <path d={barPath(cx - barW / 2, y(d.revenue), barW, h)} className={active === i ? 'fill-padma-dark' : active === null ? 'fill-padma' : 'fill-padma/55'} />
                {/* Hit target covers the whole slot, not just the bar */}
                <rect x={PAD.left + slot * i} y={PAD.top} width={slot} height={innerH} fill="transparent" onPointerEnter={() => setActive(i)} />
                {showLabel && (
                  <text x={cx} y={H - 8} textAnchor="middle" className="fill-ink-faint text-[11px]">
                    {isToday ? 'Today' : label(d.day)}
                  </text>
                )}
              </g>
            );
          })}
          {days[peak] && days[peak].revenue > 0 && active === null && (
            <text x={PAD.left + slot * peak + slot / 2} y={y(days[peak].revenue) - 6} textAnchor="middle" className="fill-ink-soft text-[11px] font-semibold tabular-nums">
              {compactTk(days[peak].revenue)}
            </text>
          )}
          <line x1={PAD.left} x2={width - PAD.right} y1={PAD.top + innerH} y2={PAD.top + innerH} stroke="#c9cfcb" strokeWidth={1} shapeRendering="crispEdges" />
        </svg>
        {a && (
          <div
            className="pointer-events-none absolute top-1 z-10 rounded-md border border-line bg-white px-3 py-2 text-sm whitespace-nowrap"
            style={{ left: Math.min(Math.max(tipX, 70), width - 70), transform: 'translateX(-50%)' }}
            role="status"
          >
            <p className="font-semibold text-ink tabular-nums">{tk(a.revenue)}</p>
            <p className="text-ink-soft tabular-nums">
              {a.orders} order{a.orders === 1 ? '' : 's'}, {longLabel(a.day)}
            </p>
          </div>
        )}
      </div>
      <details className="mt-2 text-sm">
        <summary className="cursor-pointer text-ink-soft hover:text-ink">Show as table</summary>
        <div className="mt-2 max-h-64 overflow-y-auto rounded border border-line">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#f8f9f7] text-xs text-ink-soft">
                <th className="sticky top-0 bg-[#f8f9f7] px-3 py-2 text-left font-semibold">Day</th>
                <th className="sticky top-0 bg-[#f8f9f7] px-3 py-2 text-right font-semibold">Orders</th>
                <th className="sticky top-0 bg-[#f8f9f7] px-3 py-2 text-right font-semibold">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {[...days].reverse().map((d) => (
                <tr key={d.day} className="border-t border-line">
                  <td className="px-3 py-1.5">{longLabel(d.day)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{d.orders}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{tk(d.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
