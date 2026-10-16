'use client';

import { KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import { tk } from '@/lib/format';

interface Day {
  day: string; // YYYY-MM-DD (Dhaka)
  orders: number;
  /** null when the viewer can't see sales figures */
  revenue: number | null;
}

export type ChartMetric = 'revenue' | 'orders';

const H = 300;
const PAD = { top: 22, right: 8, bottom: 26, left: 52 };
// Order counts need far less room for their axis labels than taka amounts.
const PAD_LEFT_ORDERS = 32;

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

/** Clean tick step: 1, 2, 2.5 or 5 times a power of ten. Counts use whole steps only. */
function niceMax(max: number, whole = false) {
  if (max <= 0) return whole ? { top: 4, step: 1 } : { top: 1000, step: 250 };
  const rough = max / 4;
  const pow = 10 ** Math.floor(Math.log10(rough));
  const steps = (whole ? [1, 2, 5, 10] : [1, 2, 2.5, 5, 10]).map((m) => m * pow).filter((s) => !whole || s >= 1);
  const step = steps.find((s) => s >= rough) ?? (whole ? Math.max(1, 10 * pow) : 10 * pow);
  return { top: Math.ceil(max / step) * step, step };
}

const ordersText = (n: number) => `${n} order${n === 1 ? '' : 's'}`;
const valueOf = (d: Day, metric: ChartMetric) => (metric === 'orders' ? d.orders : (d.revenue ?? 0));

/** Column with a 4px rounded data end and a square base. */
function barPath(x: number, y: number, w: number, h: number) {
  if (h <= 0) return '';
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

/**
 * Daily bars for the last 30 days. `metric="revenue"` (default) plots order value in taka;
 * `metric="orders"` plots the number of orders, for staff who can't see sales figures.
 */
export function RevenueChart({ days, metric = 'revenue', fill = false }: { days: Day[]; metric?: ChartMetric; /** Grow to the parent's height (never below 300px). */ fill?: boolean }) {
  const byOrders = metric === 'orders';
  const value = (d: Day) => valueOf(d, metric);
  const tick = (n: number) => (byOrders ? String(n) : compactTk(n));
  const padLeft = byOrders ? PAD_LEFT_ORDERS : PAD.left;
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(720);
  const [height, setHeight] = useState(H);
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setWidth(Math.max(280, Math.floor(entry.contentRect.width)));
      if (fill) setHeight(Math.max(H, Math.floor(entry.contentRect.height)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [fill]);

  const { top, step } = useMemo(() => niceMax(Math.max(...days.map((d) => valueOf(d, metric)), 0), metric === 'orders'), [days, metric]);
  const peak = useMemo(() => days.reduce((best, d, i) => (valueOf(d, metric) > (days[best] ? valueOf(days[best], metric) : -1) ? i : best), 0), [days, metric]);

  const innerW = width - padLeft - PAD.right;
  const innerH = height - PAD.top - PAD.bottom;
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
  const tipX = active !== null ? padLeft + slot * active + slot / 2 : 0;
  const peakDay = days[peak];
  const summary = byOrders
    ? `Daily orders for the last 30 days. Most: ${ordersText(peakDay ? peakDay.orders : 0)} on ${peakDay ? longLabel(peakDay.day) : ''}.`
    : `Daily revenue for the last 30 days. Highest: ${tk(peakDay?.revenue)} on ${peakDay ? longLabel(peakDay.day) : ''}.`;

  return (
    <div className={fill ? 'flex flex-1 flex-col' : undefined}>
      {/* With `fill`, the SVG is taken out of flow so the box's size comes from the layout, not from the last drawn height */}
      <div ref={box} className={fill ? 'relative min-h-[300px] flex-1' : 'relative'} onPointerLeave={() => setActive(null)}>
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={`${summary} Use the left and right arrow keys to read each day.`}
          tabIndex={0}
          onKeyDown={onKey}
          onFocus={() => setActive((v) => v ?? days.length - 1)}
          onBlur={() => setActive(null)}
          className={`block rounded focus-visible:outline-2 focus-visible:outline-marigold ${fill ? 'absolute inset-0' : ''}`}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line x1={padLeft} x2={width - PAD.right} y1={y(t)} y2={y(t)} stroke="#e2e6e3" strokeWidth={1} shapeRendering="crispEdges" />
              <text x={padLeft - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-ink-faint text-[11px] tabular-nums">
                {tick(t)}
              </text>
            </g>
          ))}
          {days.map((d, i) => {
            const cx = padLeft + slot * i + slot / 2;
            const v = value(d);
            const h = (v / top) * innerH;
            const isToday = i === days.length - 1;
            const showLabel = isToday || (days.length - 1 - i) % labelEvery === 0;
            return (
              <g key={d.day}>
                <path d={barPath(cx - barW / 2, y(v), barW, h)} className={active === i ? 'fill-padma-dark' : active === null ? 'fill-padma' : 'fill-padma/55'} />
                {/* Hit target covers the whole slot, not just the bar */}
                <rect x={padLeft + slot * i} y={PAD.top} width={slot} height={innerH} fill="transparent" onPointerEnter={() => setActive(i)} />
                {showLabel && (
                  <text x={cx} y={height - 8} textAnchor="middle" className="fill-ink-faint text-[11px]">
                    {isToday ? 'Today' : label(d.day)}
                  </text>
                )}
              </g>
            );
          })}
          {peakDay && value(peakDay) > 0 && active === null && (
            <text x={padLeft + slot * peak + slot / 2} y={y(value(peakDay)) - 6} textAnchor="middle" className="fill-ink-soft text-[11px] font-semibold tabular-nums">
              {tick(value(peakDay))}
            </text>
          )}
          <line x1={padLeft} x2={width - PAD.right} y1={PAD.top + innerH} y2={PAD.top + innerH} stroke="#c9cfcb" strokeWidth={1} shapeRendering="crispEdges" />
        </svg>
        {a && (
          <div
            className="pointer-events-none absolute top-1 z-10 rounded-md border border-line bg-white px-3 py-2 text-sm whitespace-nowrap"
            style={{ left: Math.min(Math.max(tipX, 70), width - 70), transform: 'translateX(-50%)' }}
            role="status"
          >
            {byOrders ? (
              <>
                <p className="font-semibold text-ink tabular-nums">{ordersText(a.orders)}</p>
                <p className="text-ink-soft tabular-nums">{longLabel(a.day)}</p>
              </>
            ) : (
              <>
                <p className="font-semibold text-ink tabular-nums">{tk(a.revenue)}</p>
                <p className="text-ink-soft tabular-nums">
                  {ordersText(a.orders)}, {longLabel(a.day)}
                </p>
              </>
            )}
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
                {!byOrders && <th className="sticky top-0 bg-[#f8f9f7] px-3 py-2 text-right font-semibold">Revenue</th>}
              </tr>
            </thead>
            <tbody>
              {[...days].reverse().map((d) => (
                <tr key={d.day} className="border-t border-line">
                  <td className="px-3 py-1.5">{longLabel(d.day)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{d.orders}</td>
                  {!byOrders && <td className="px-3 py-1.5 text-right tabular-nums">{tk(d.revenue)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
