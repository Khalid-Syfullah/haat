/** Date ranges for the reports page. Days are Dhaka calendar days (UTC+6, no DST) as YYYY-MM-DD. */

export const PRESETS = [
  { key: '7d', label: 'Last 7 days' },
  { key: '30d', label: 'Last 30 days' },
  { key: '90d', label: 'Last 90 days' },
  { key: 'month', label: 'This month' },
  { key: 'last-month', label: 'Last month' },
] as const;

export type PresetKey = (typeof PRESETS)[number]['key'];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function dhakaToday(now = Date.now()) {
  return new Date(now + 6 * 3600_000).toISOString().slice(0, 10);
}

export function addDays(day: string, n: number) {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
}

export function isDay(s: string | undefined): s is string {
  return !!s && DAY_RE.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().startsWith(s);
}

export function presetRange(key: PresetKey, today: string): { from: string; to: string } {
  switch (key) {
    case '7d':
      return { from: addDays(today, -6), to: today };
    case '90d':
      return { from: addDays(today, -89), to: today };
    case 'month':
      return { from: `${today.slice(0, 8)}01`, to: today };
    case 'last-month': {
      const firstThis = `${today.slice(0, 8)}01`;
      const to = addDays(firstThis, -1);
      return { from: `${to.slice(0, 8)}01`, to };
    }
    default:
      return { from: addDays(today, -29), to: today };
  }
}

/** Reads ?range=7d or ?from=&to= into a checked range. Falls back to the last 30 days with an error message. */
export function resolveRange(sp: Record<string, string>, today = dhakaToday()) {
  const preset = PRESETS.find((p) => p.key === sp.range)?.key;
  let error: string | null = null;
  let range = presetRange(preset ?? '30d', today);
  if (!preset && (sp.from || sp.to)) {
    const from = sp.from;
    const to = sp.to || today;
    if (!isDay(from) || !isDay(to)) error = 'Those dates could not be read, so this shows the last 30 days.';
    else if (from > to) error = 'The start date was after the end date, so this shows the last 30 days.';
    else if (daysBetween(from, to) > 731) error = 'Reports cover two years at most, so this shows the last 30 days.';
    else range = { from, to };
  }
  const active = PRESETS.find((p) => {
    const r = presetRange(p.key, today);
    return r.from === range.from && r.to === range.to;
  })?.key;
  return { ...range, days: daysBetween(range.from, range.to), active: active ?? null, error, today };
}

/** "17 Sep" or "17 Sep 2026". Formatted by hand so server and browser always agree. */
export function dayLabel(day: string, withYear = false) {
  const base = `${Number(day.slice(8, 10))} ${MONTHS[Number(day.slice(5, 7)) - 1]}`;
  return withYear ? `${base} ${day.slice(0, 4)}` : base;
}

/** "17 Sep to 16 Oct 2026" */
export function rangeLabel(from: string, to: string) {
  if (from === to) return dayLabel(from, true);
  return `${dayLabel(from, from.slice(0, 4) !== to.slice(0, 4))} to ${dayLabel(to, true)}`;
}
