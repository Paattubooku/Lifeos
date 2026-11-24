import { COFFEE_KCAL } from '@/features/food/lib/extras';
import { addDays, type DateString, weekStart } from '@/lib/dates';

/** Sessions count as done at the same 80 % as Today's workout block (F11). */
export const SESSION_DONE_PCT = 80;
export const FOOD_DAYS = 14;
export const WATER_DAYS = 14;
export const TRAIN_WEEKS = 8;

type Live = { deleted_at?: string | null };
export type FoodRow = Live & {
  date: string;
  kcal: number | string | null;
  protein_g: number | string | null;
};
export type CoffeeRow = Live & { date: string };
export type SessionLike = Live & { date: string; completion: number | null };

export type DayValue = { date: DateString; value: number | null };

/** The last `n` dates ending today, oldest first. */
export const lastDates = (today: DateString, n: number): DateString[] =>
  Array.from({ length: n }, (_, i) => addDays(today, i - n + 1));

/** kcal (food + coffee) and protein per day; null for days with nothing logged. */
export function dailyNutrition(
  food: readonly FoodRow[],
  coffee: readonly CoffeeRow[],
  today: DateString,
  n = FOOD_DAYS,
): { kcal: DayValue[]; protein: DayValue[] } {
  const kcal = new Map<string, number>();
  const protein = new Map<string, number>();
  for (const f of food) {
    if (f.deleted_at) continue;
    kcal.set(f.date, (kcal.get(f.date) ?? 0) + Number(f.kcal ?? 0));
    protein.set(f.date, (protein.get(f.date) ?? 0) + Number(f.protein_g ?? 0));
  }
  for (const c of coffee) {
    if (c.deleted_at) continue;
    kcal.set(c.date, (kcal.get(c.date) ?? 0) + COFFEE_KCAL);
    protein.set(c.date, protein.get(c.date) ?? 0);
  }
  const dates = lastDates(today, n);
  return {
    kcal: dates.map((date) => ({
      date,
      value: kcal.has(date) ? Math.round(kcal.get(date)!) : null,
    })),
    protein: dates.map((date) => ({
      date,
      value: protein.has(date) ? Math.round(protein.get(date)!) : null,
    })),
  };
}

/** Average of the logged days among the last `days` values (today excluded when `skipLast`). */
export function avgLogged(values: readonly DayValue[], days = 7, skipLast = false): number | null {
  const pool = (skipLast ? values.slice(0, -1) : values).slice(-days);
  const v = pool.map((d) => d.value).filter((x): x is number => x !== null);
  return v.length ? Math.round(v.reduce((s, x) => s + x, 0) / v.length) : null;
}

/** Done sessions per ISO week, oldest first, ending with this week. */
export function weeklySessions(
  sessions: readonly SessionLike[],
  today: DateString,
  weeks = TRAIN_WEEKS,
): { week: DateString; done: number }[] {
  const mon = weekStart(today);
  return Array.from({ length: weeks }, (_, i) => {
    const week = addDays(mon, (i - weeks + 1) * 7);
    const end = addDays(week, 6);
    const done = sessions.filter(
      (s) =>
        !s.deleted_at &&
        s.date >= week &&
        s.date <= end &&
        s.date <= today &&
        (s.completion ?? 0) >= SESSION_DONE_PCT,
    ).length;
    return { week, done };
  });
}

/** Water per day (null = nothing logged) and how many of the last 7 reached the goal. */
export function waterDays(
  totals: ReadonlyMap<DateString, number>,
  today: DateString,
  goal: number,
  n = WATER_DAYS,
): { days: DayValue[]; avg7: number | null; hit7: number } {
  const days = lastDates(today, n).map((date) => {
    const ml = totals.get(date);
    return { date, value: ml && ml > 0 ? ml : null };
  });
  // The 7 completed days before today (today is still in progress).
  const week = days.slice(-8, -1);
  return {
    days,
    avg7: avgLogged(week, 7),
    hit7: week.filter((d) => (d.value ?? 0) >= goal).length,
  };
}

/** Percentage change of the latest week vs the one before ("+8% vol"); null without both. */
export function pctChange(now: number, before: number): number | null {
  if (!(before > 0)) return null;
  return Math.round(((now - before) / before) * 100);
}
