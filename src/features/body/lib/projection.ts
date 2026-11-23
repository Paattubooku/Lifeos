import { addDays, type DateString, daysBetween } from '@/lib/dates';

import { KCAL_PER_KG } from './energy';
import type { AvgPoint } from './weight';

/**
 * Least squares, as Food-Tracker `api/prediction.js` (same maths), on
 * explicit x values (days) instead of the row index.
 */
export function linearRegression(points: readonly { x: number; y: number }[]): {
  slope: number;
  intercept: number;
} {
  const n = points.length;
  if (n === 0) return { slope: 0, intercept: 0 };
  const sumX = points.reduce((s, p) => s + p.x, 0);
  const sumY = points.reduce((s, p) => s + p.y, 0);
  const sumXY = points.reduce((s, p) => s + p.x * p.y, 0);
  const sumX2 = points.reduce((s, p) => s + p.x * p.x, 0);
  const denom = n * sumX2 - sumX * sumX;
  const slope = denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 0;
  return { slope, intercept: (sumY - slope * sumX) / n };
}

/** PRD F13: under 14 data points, no projection. */
export const MIN_POINTS = 14;
export const TREND_WINDOW_DAYS = 28;
export const INTAKE_WINDOW_DAYS = 14;

export type TrendProjection =
  | { status: 'not_enough'; points: number }
  | { status: 'flat'; kgPerWeek: number }
  | { status: 'ok'; kgPerWeek: number; date: DateString; days: number; reached: boolean };

/** (a) Trend: regression over the last 28 days of 7-day averages → kg/week and date to goal. */
export function trendProjection(
  points: readonly AvgPoint[],
  today: DateString,
  goalKg: number,
): TrendProjection {
  const from = addDays(today, -(TREND_WINDOW_DAYS - 1));
  const window = points.filter((p) => p.date >= from && p.date <= today);
  if (window.length < MIN_POINTS) return { status: 'not_enough', points: window.length };
  const { slope, intercept } = linearRegression(
    window.map((p) => ({ x: daysBetween(from, p.date), y: p.avg7 })),
  );
  const kgPerWeek = Math.round(slope * 7 * 100) / 100;
  if (slope >= 0) return { status: 'flat', kgPerWeek };
  const now = intercept + slope * daysBetween(from, today);
  if (now <= goalKg) return { status: 'ok', kgPerWeek, date: today, days: 0, reached: true };
  const days = Math.ceil((goalKg - now) / slope);
  return { status: 'ok', kgPerWeek, date: addDays(today, days), days, reached: false };
}

export type IntakeProjection =
  | { status: 'not_enough'; days: number }
  | { status: 'flat'; deficit: number }
  | { status: 'ok'; deficit: number; kgPerWeek: number; date: DateString; days: number };

/** (b) Intake: avg daily deficit over the last 14 logged days ÷ 7,700 kcal/kg. */
export function intakeProjection(
  dayIntake: ReadonlyMap<DateString, number>,
  tdeeKcal: number,
  currentKg: number | null,
  goalKg: number,
  today: DateString,
): IntakeProjection {
  const from = addDays(today, -INTAKE_WINDOW_DAYS);
  // Complete days only (today isn't over).
  const days = [...dayIntake.entries()].filter(([d, k]) => d >= from && d < today && k > 0);
  if (days.length < MIN_POINTS / 2 || currentKg === null)
    return { status: 'not_enough', days: days.length };
  const deficit = Math.round(tdeeKcal - days.reduce((s, [, k]) => s + k, 0) / days.length);
  if (deficit <= 0) return { status: 'flat', deficit };
  const kgPerDay = deficit / KCAL_PER_KG;
  const toGo = Math.max(currentKg - goalKg, 0);
  const n = Math.ceil(toGo / kgPerDay);
  return {
    status: 'ok',
    deficit,
    kgPerWeek: Math.round(kgPerDay * 7 * 100) / 100,
    date: addDays(today, n),
    days: n,
  };
}
