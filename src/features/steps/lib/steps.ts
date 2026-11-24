import type { Change } from '@/features/routine/lib/changes';
import { addDays, type DateString } from '@/lib/dates';
import { formatIndianNumber } from '@/lib/format';

/** AutoFit StepTracker: minimum from profile (6,000), stretch = minimum + 4,000. */
export const DEFAULT_MIN = 6000;
export const STRETCH_EXTRA = 4000;
/** ~100 steps a minute of brisk walking (reference). */
export const STEPS_PER_MIN = 100;
/** Reference colour threshold: some movement. */
export const SOME_STEPS = 3000;
export const QUICK_ADD = [500, 1000, 2000] as const;
export const MAX_STEPS = 100_000;

export const targets = (min: number | null | undefined) => {
  const m = min && min > 0 ? min : DEFAULT_MIN;
  return { min: m, stretch: m + STRETCH_EXTRA };
};

export type StepsTone = 'done' | 'some' | 'low';
export const stepsTone = (steps: number, min: number): StepsTone =>
  steps >= min ? 'done' : steps >= SOME_STEPS ? 'some' : 'low';

const n = (v: number) => formatIndianNumber(v);

/**
 * Time-aware hint (PRD F21): remaining ÷ hours left until sleep time.
 * "2,400 steps left: a 25-min walk after dinner".
 */
export function stepsHint(
  steps: number,
  t: { min: number; stretch: number },
  nowMin: number,
  sleepMin: number,
  dinnerMin = 20 * 60,
): { text: string; urgent: boolean } {
  const remaining = Math.max(0, t.min - steps);
  if (remaining === 0) {
    const toStretch = t.stretch - steps;
    return toStretch > 0
      ? {
          text: `Minimum done. ${n(toStretch)} more for the ${n(t.stretch)} stretch.`,
          urgent: false,
        }
      : { text: `Stretch target done: ${n(steps)} steps.`, urgent: false };
  }
  const walk = Math.ceil(remaining / STEPS_PER_MIN);
  const hoursLeft = (sleepMin - nowMin) / 60;
  if (hoursLeft <= 0) return { text: `${n(remaining)} steps short today.`, urgent: true };
  const perHour = Math.ceil(remaining / Math.max(hoursLeft, 1));
  if (nowMin < dinnerMin - 3 * 60)
    return {
      text: `${n(remaining)} steps left: about ${n(perHour)} an hour until bedtime.`,
      urgent: false,
    };
  if (nowMin < dinnerMin)
    return { text: `${n(remaining)} steps left: a ${walk}-min walk after dinner.`, urgent: false };
  return { text: `${n(remaining)} steps left: a ${walk}-min walk now.`, urgent: true };
}

export type StepsRow = {
  client_id: string;
  date: string;
  steps: number;
  source: string;
  deleted_at?: string | null;
};

/** One row per day (unique): reuse and revive the day's row. */
/** Where a day's count came from: typed, iPhone motion chip, or Apple Health. */
export type StepsSource = 'manual' | 'phone' | 'health';

export function planSteps(
  date: DateString,
  existing: Pick<StepsRow, 'client_id'> | null,
  steps: number,
  source: StepsSource,
): Change[] {
  return [
    {
      op: 'upsert',
      table: 'steps_log',
      ...(existing ? { clientId: existing.client_id } : {}),
      row: {
        date,
        steps: Math.max(0, Math.min(MAX_STEPS, Math.round(steps))),
        source,
        deleted_at: null,
      },
    },
  ];
}

/**
 * Automatic counts to write: only days whose count changed (or that have no
 * row), skipping zero days with no row (both sources return zeros when access
 * is off). A higher manual entry is kept: the phone can't count steps taken
 * without it.
 */
export function healthWrites(
  counts: ReadonlyMap<DateString, number>,
  rows: readonly StepsRow[],
  source: 'phone' | 'health' = 'health',
): Change[] {
  const out: Change[] = [];
  for (const [date, steps] of counts) {
    const row = rows.find((r) => r.date === date) ?? null;
    if (!row && steps === 0) continue;
    const live = row && !row.deleted_at ? row : null;
    if (live && live.steps === steps && live.source === source) continue;
    if (live && live.source === 'manual' && live.steps > steps) continue;
    out.push(...planSteps(date, row, steps, source));
  }
  return out;
}

/** Last `n` days ending today with the day's steps (null = nothing logged). */
export function lastDays(
  rows: readonly StepsRow[],
  today: DateString,
  n = 14,
): { date: DateString; steps: number | null }[] {
  return Array.from({ length: n }, (_, i) => {
    const date = addDays(today, i - n + 1);
    const r = rows.find((x) => x.date === date && !x.deleted_at);
    return { date, steps: r ? r.steps : null };
  });
}

/** 7-day average of logged days before today, and days at the minimum among them. */
export function weekStats(days: readonly { steps: number | null }[], min: number) {
  const week = days
    .slice(-8, -1)
    .map((d) => d.steps)
    .filter((s): s is number => s !== null);
  return {
    avg7: week.length ? Math.round(week.reduce((a, b) => a + b, 0) / week.length) : null,
    hit7: week.filter((s) => s >= min).length,
  };
}
