/**
 * Water pace engine (PRD F07), ported from My-Tracker `reminderEngine.ts`
 * steps 3 and 6–9, on IST plan times instead of a stored UTC offset.
 * Pace runs from wake to the Water target block (DESIGN_NOTES A6).
 */

export type Urgency = 'low' | 'medium' | 'high';
export type PaceStatus = 'sleeping' | 'goal_reached' | 'on_track' | 'behind';

export type Pace = {
  status: PaceStatus;
  /** ml expected by now on a straight line from wake to the target time. */
  expected: number;
  /** expected − actual (≤ 0 when on track). */
  gap: number;
  urgency: Urgency;
  /** One tap to catch up: round50(gap) clamped to 50–500. */
  suggested: number;
};

export type PaceInput = {
  /** Minutes on the logical day (see today/lib/timeline nowDayMinutes). */
  nowMin: number;
  wakeMin: number;
  /** Water target block time (default 21:00). */
  targetMin: number;
  /** Sleep time: after it, no nagging. */
  sleepMin: number;
  targetMl: number;
  actualMl: number;
};

export const MIN_ENTRY_ML = 1;
export const MAX_ENTRY_ML = 2000;
/** Behind-pace notifications only from this gap (DESIGN_NOTES A7; used by F15). */
export const NOTIFY_GAP_ML = 300;

export function classifyUrgency(gap: number): Urgency {
  if (gap > 500) return 'high';
  if (gap > 200) return 'medium';
  return 'low';
}

export function suggestedAmount(gap: number): number {
  return Math.min(Math.max(Math.round(gap / 50) * 50, 50), 500);
}

/** expected = clamp((now − wake) ÷ (target − wake), 0, 1) × target ml. */
export function expectedBy(
  nowMin: number,
  wakeMin: number,
  targetMin: number,
  targetMl: number,
): number {
  const span = targetMin - wakeMin;
  if (span <= 0) return targetMl;
  const progress = Math.min(Math.max((nowMin - wakeMin) / span, 0), 1);
  return Math.round(progress * targetMl);
}

export function waterPace(p: PaceInput): Pace {
  const expected = expectedBy(p.nowMin, p.wakeMin, p.targetMin, p.targetMl);
  const gap = expected - p.actualMl;
  const base = { expected, gap, urgency: classifyUrgency(gap), suggested: suggestedAmount(gap) };
  if (p.actualMl >= p.targetMl) return { ...base, status: 'goal_reached' };
  if (p.nowMin < p.wakeMin || p.nowMin >= p.sleepMin) return { ...base, status: 'sleeping' };
  return { ...base, status: gap > 0 ? 'behind' : 'on_track' };
}

/** Why an amount can't be logged (PRD F07 AC3), or null. */
export function validateAmount(ml: number): string | null {
  if (!Number.isFinite(ml) || !Number.isInteger(ml)) return 'Enter a whole number of ml.';
  if (ml < MIN_ENTRY_ML) return 'At least 1 ml.';
  if (ml > MAX_ENTRY_ML) return 'At most 2,000 ml at a time.';
  return null;
}
