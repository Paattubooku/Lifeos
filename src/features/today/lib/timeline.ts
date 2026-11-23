import { istMinutesOfDay, LOGICAL_DAY_START_HOUR } from '@/lib/dates';
import { dayMinutes } from '@/features/routine/lib/blocks';

/** Minutes from IST midnight on the logical day (00:00–02:59 → 1440–1619). */
export function nowDayMinutes(now: number): number {
  const m = istMinutesOfDay(now);
  return m < LOGICAL_DAY_START_HOUR * 60 ? m + 1440 : m;
}

export type TimedBlock = { client_id: string; start_time: string; duration_min: number };

export const startOf = (b: Pick<TimedBlock, 'start_time'>) => dayMinutes(b.start_time);
/** A block's window is at least one minute long. */
export const endOf = (b: Pick<TimedBlock, 'start_time' | 'duration_min'>) =>
  startOf(b) + Math.max(b.duration_min, 1);

/** Amber "overdue" begins this long after a block's end (PRD F05). */
export const OVERDUE_AFTER_MIN = 30;

export type BlockState = 'done' | 'skipped' | 'current' | 'due' | 'overdue' | 'upcoming';

/**
 * done / skipped win; otherwise by time: upcoming → current (in its window) →
 * due (ended < 30 min ago) → overdue.
 */
export function blockState(
  block: Pick<TimedBlock, 'start_time' | 'duration_min'>,
  ctx: { nowMin: number; status?: 'done' | 'skipped' | null; autoDone?: boolean },
): BlockState {
  if (ctx.status === 'done' || ctx.autoDone) return 'done';
  if (ctx.status === 'skipped') return 'skipped';
  const start = startOf(block);
  const end = endOf(block);
  if (ctx.nowMin < start) return 'upcoming';
  if (ctx.nowMin < end) return 'current';
  if (ctx.nowMin < end + OVERDUE_AFTER_MIN) return 'due';
  return 'overdue';
}

/**
 * The block to highlight: of the open blocks whose window contains now, the
 * one that started last (a new block takes over from an overlapping one).
 */
export function currentBlock<T extends TimedBlock>(
  blocks: readonly T[],
  states: ReadonlyMap<string, BlockState>,
): T | null {
  let best: T | null = null;
  for (const b of blocks) {
    if (states.get(b.client_id) !== 'current') continue;
    if (!best || startOf(b) >= startOf(best)) best = b;
  }
  return best;
}

/** First block that hasn't started yet. */
export function nextBlock<T extends TimedBlock>(blocks: readonly T[], nowMin: number): T | null {
  return (
    [...blocks].sort((a, b) => startOf(a) - startOf(b)).find((b) => startOf(b) > nowMin) ?? null
  );
}

/** "25 min", "1 h 5 min", "2 h". */
export function formatMinutes(min: number): string {
  const m = Math.max(0, Math.round(min));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest === 0 ? `${h} h` : `${h} h ${rest} min`;
}
