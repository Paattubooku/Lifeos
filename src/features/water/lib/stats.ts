import { addDays, type DateString } from '@/lib/dates';

/** Port of My-Tracker `getStats`, over a long window (the reference's 7-day window capped streaks at 7). */

export function dailyTotals(
  entries: readonly { date: DateString; amount_ml: number }[],
): Map<DateString, number> {
  const m = new Map<DateString, number>();
  for (const e of entries) m.set(e.date, (m.get(e.date) ?? 0) + e.amount_ml);
  return m;
}

export type WaterStats = {
  current: number;
  best: { days: number; end: DateString } | null;
  /** Average of the 7 complete days before today. */
  avg7: number;
  /** The 7 days before today, oldest first. */
  last7: { date: DateString; ml: number; hit: boolean }[];
  hit7: number;
};

/**
 * Current streak of days at goal counted back from today; today may still
 * be in progress, so a short today doesn't break it (it just isn't counted).
 */
export function waterStats(
  totals: ReadonlyMap<DateString, number>,
  today: DateString,
  goal: number,
): WaterStats {
  const hit = (d: DateString) => (totals.get(d) ?? 0) >= goal;
  let current = 0;
  let d = hit(today) ? today : addDays(today, -1);
  while (hit(d)) {
    current += 1;
    d = addDays(d, -1);
  }

  let best: WaterStats['best'] = null;
  const dates = [...totals.keys()].sort();
  if (dates.length > 0) {
    let run = 0;
    for (let x = dates[0] as DateString; x <= today; x = addDays(x, 1)) {
      run = hit(x) ? run + 1 : 0;
      if (run > 0 && (!best || run > best.days)) best = { days: run, end: x };
    }
  }

  const last7 = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(today, i - 7);
    const ml = totals.get(date) ?? 0;
    return { date, ml, hit: ml >= goal };
  });
  return {
    current,
    best,
    avg7: Math.round(last7.reduce((s, x) => s + x.ml, 0) / 7),
    last7,
    hit7: last7.filter((x) => x.hit).length,
  };
}
