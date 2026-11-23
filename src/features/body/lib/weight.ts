import { addDays, type DateString, daysBetween } from '@/lib/dates';

export type WeightRow = {
  date: DateString;
  weight_kg: number | string;
  note?: string | null;
  deleted_at?: string | null;
};
export type AvgPoint = { date: DateString; weight: number; avg7: number; salty: boolean };

const live = <T extends { deleted_at?: string | null }>(rows: readonly T[]) =>
  rows.filter((r) => !r.deleted_at);

/**
 * 7-day trailing average exactly like `v_weight_trend` (F13 AC1): for each
 * weigh-in, the mean of weigh-ins in [date − 6, date], rounded to 2 decimals.
 */
export function withAvg7(rows: readonly WeightRow[]): AvgPoint[] {
  const sorted = live(rows)
    .map((r) => ({ date: r.date, weight: Number(r.weight_kg), salty: r.note === 'salty' }))
    .sort((a, b) => a.date.localeCompare(b.date));
  return sorted.map((p) => {
    const from = addDays(p.date, -6);
    const window = sorted.filter((q) => q.date >= from && q.date <= p.date);
    const avg = window.reduce((s, q) => s + q.weight, 0) / window.length;
    return { ...p, avg7: Math.round(avg * 100) / 100 };
  });
}

/** The 7-day average on or before a date (null before any weigh-in). */
export function avgOn(points: readonly AvgPoint[], date: DateString): number | null {
  let out: number | null = null;
  for (const p of points) if (p.date <= date) out = p.avg7;
  return out;
}

export type WeightStats = {
  latest: AvgPoint | null;
  avg7: number | null;
  /** vs the average 7 days earlier. */
  change7: number | null;
  /** first weigh-in (or profile start) − current average. */
  totalLost: number | null;
  since: DateString | null;
};

export function weightStats(
  points: readonly AvgPoint[],
  today: DateString,
  startKg: number | null,
): WeightStats {
  const latest = points.at(-1) ?? null;
  const avg = latest ? latest.avg7 : null;
  const before = avgOn(points, addDays(today, -7));
  const first = points[0] ?? null;
  const start = first ? first.weight : startKg;
  const r1 = (v: number) => Math.round(v * 10) / 10;
  return {
    latest,
    avg7: avg,
    change7: avg !== null && before !== null ? r1(avg - before) : null,
    totalLost: avg !== null && start !== null ? r1(avg - start) : null,
    since: first?.date ?? null,
  };
}

/** Points in a range: 4W / 12W / All. */
export function inRange(
  points: readonly AvgPoint[],
  today: DateString,
  range: '4W' | '12W' | 'All',
) {
  if (range === 'All') return [...points];
  const days = range === '4W' ? 28 : 84;
  return points.filter((p) => daysBetween(p.date, today) < days);
}

/** "7-day average becomes 88.4 kg (−0.6 vs last week)" for a weigh-in being entered. */
export function previewAvg(
  points: readonly AvgPoint[],
  today: DateString,
  kg: number,
): { avg7: number; change7: number | null } {
  const rows: WeightRow[] = [
    ...points.filter((p) => p.date !== today).map((p) => ({ date: p.date, weight_kg: p.weight })),
    { date: today, weight_kg: kg },
  ];
  const next = withAvg7(rows);
  const avg = next.at(-1)!.avg7;
  const before = avgOn(next, addDays(today, -7));
  return {
    avg7: Math.round(avg * 10) / 10,
    change7: before === null ? null : Math.round((avg - before) * 10) / 10,
  };
}

/**
 * One weigh-in per logical day: editing replaces it (reusing the day's row,
 * reviving it if deleted). `salty` → note 'salty' (A20 chart marker).
 */
export function planWeighIn(
  date: DateString,
  kg: number,
  salty: boolean,
  existing: { client_id: string } | null,
): { table: 'weight_log'; clientId?: string; row: Record<string, unknown> } {
  return {
    table: 'weight_log',
    ...(existing ? { clientId: existing.client_id } : {}),
    row: {
      date,
      weight_kg: Math.round(kg * 10) / 10,
      note: salty ? 'salty' : null,
      deleted_at: null,
    },
  };
}

export const WEIGH_MIN = 20;
export const WEIGH_MAX = 300;
