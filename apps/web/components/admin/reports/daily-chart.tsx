'use client';

import { KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import { tk } from '@/lib/format';
import { dayLabel } from './range';

interface Day {
  day: string; // YYYY-MM-DD (Dhaka)
  orders: number;
  revenue: number;
}

interface Bucket extends Day {
  /** Last day in the bucket (same as `day` for daily bars). */
  end: string;
}

const H = 280;
const PAD = { top: 22, right: 8, bottom: 26, left: 52 };
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const longLabel = (d: string) => `${WEEKDAYS[new Date(`${d}T00:00:00Z`).getUTCDay()]} ${dayLabel(d)}`;

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

/** Daily bars; ranges over 120 days are grouped into weeks so bars stay readable. */
export function DailyChart({ days, today }: { days: Day[]; today: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(720);
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(260, Math.floor(entry.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const weekly = days.length > 120;
  const bars: Bucket[] = useMemo(() => {
    if (!weekly) return days.map((d) => ({ ...d, end: d.day }));
    const out: Bucket[] = [];
    for (let i = 0; i < days.length; i += 7) {
      const chunk = days.slice(i, i + 7);
      out.push({
        day: chunk[0].day,
        end: chunk[chunk.length - 1].day,
        orders: chunk.reduce((s, d) => s + d.orders, 0),
        revenue: chunk.reduce((s, d) => s + d.revenue, 0),
      });
    }
    return out;
  }, [days, weekly]);

  const { top, step } = useMemo(() => niceMax(Math.max(...bars.map((d) => d.revenue), 0)), [bars]);
  const peak = useMemo(() => bars.reduce((best, d, i) => (d.revenue > (bars[best]?.revenue ?? -1) ? i : best), 0), [bars]);

  const innerW = width - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const slot = innerW / Math.max(1, bars.length);
  const barW = Math.max(2, Math.min(28, slot * 0.72));
  const y = (v: number) => PAD.top + innerH - (v / top) * innerH;
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
  // Roughly 52px per axis label, counted back from the last bar
  const labelEvery = Math.max(1, Math.ceil(52 / slot));

  const what = (b: Bucket) => (weekly ? `${dayLabel(b.day)} to ${dayLabel(b.end)}` : b.day === today ? 'Today' : longLabel(b.day));

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      setActive((a) => {
        const cur = a ?? bars.length - 1;
        return Math.max(0, Math.min(bars.length - 1, cur + (e.key === 'ArrowRight' ? 1 : -1)));
      });
    } else if (e.key === 'Escape') setActive(null);
  };

  const a = active !== null ? bars[active] : null;
  const tipX = active !== null ? PAD.left + slot * active + slot / 2 : 0;
  const total = bars.reduce((s, b) => s + b.revenue, 0);

  return (
    <div>
      <div ref={box} className="relative overflow-hidden" onPointerLeave={() => setActive(null)}>
        <svg
          width={width}
          height={H}
          role="img"
          aria-label={`${weekly ? 'Weekly' : 'Daily'} revenue, ${tk(total)} in total. Highest: ${tk(bars[peak]?.revenue)} on ${bars[peak] ? what(bars[peak]) : ''}. Use the left and right arrow keys to read each ${weekly ? 'week' : 'day'}.`}
          tabIndex={0}
          onKeyDown={onKey}
          onFocus={() => setActive((v) => v ?? bars.length - 1)}
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
          {bars.map((d, i) => {
            const cx = PAD.left + slot * i + slot / 2;
            const h = (d.revenue / top) * innerH;
            const showLabel = (bars.length - 1 - i) % labelEvery === 0;
            return (
              <g key={d.day}>
                <path d={barPath(cx - barW / 2, y(d.revenue), barW, h)} className={active === i ? 'fill-padma-dark' : active === null ? 'fill-padma' : 'fill-padma/55'} />
                {/* Hit target covers the whole slot, not just the bar */}
                <rect x={PAD.left + slot * i} y={PAD.top} width={slot} height={innerH} fill="transparent" onPointerEnter={() => setActive(i)} />
                {showLabel && (
                  <text
                    x={cx + 22 > width ? width - 1 : cx}
                    y={H - 8}
                    textAnchor={cx + 22 > width ? 'end' : 'middle'}
                    className="fill-ink-faint text-[11px]"
                  >
                    {!weekly && d.day === today ? 'Today' : dayLabel(d.day)}
                  </text>
                )}
              </g>
            );
          })}
          {bars[peak] && bars[peak].revenue > 0 && active === null && (
            <text x={PAD.left + slot * peak + slot / 2} y={y(bars[peak].revenue) - 6} textAnchor="middle" className="fill-ink-soft text-[11px] font-semibold tabular-nums">
              {compactTk(bars[peak].revenue)}
            </text>
          )}
          <line x1={PAD.left} x2={width - PAD.right} y1={PAD.top + innerH} y2={PAD.top + innerH} stroke="#c9cfcb" strokeWidth={1} shapeRendering="crispEdges" />
        </svg>
        {a && (
          <div
            className="pointer-events-none absolute top-1 z-10 rounded-md border border-line bg-white px-3 py-2 text-sm whitespace-nowrap"
            style={{ left: Math.min(Math.max(tipX, 80), width - 80), transform: 'translateX(-50%)' }}
            role="status"
          >
            <p className="font-semibold text-ink tabular-nums">{tk(a.revenue)}</p>
            <p className="text-ink-soft tabular-nums">
              {a.orders} order{a.orders === 1 ? '' : 's'}, {what(a)}
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
                <th className="sticky top-0 bg-[#f8f9f7] px-3 py-2 text-left font-semibold">{weekly ? 'Week' : 'Day'}</th>
                <th className="sticky top-0 bg-[#f8f9f7] px-3 py-2 text-right font-semibold">Orders</th>
                <th className="sticky top-0 bg-[#f8f9f7] px-3 py-2 text-right font-semibold">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {[...bars].reverse().map((d) => (
                <tr key={d.day} className="border-t border-line">
                  <td className="px-3 py-1.5">{what(d)}</td>
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
