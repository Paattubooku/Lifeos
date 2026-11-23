import { type BlockLike, hhmm } from '@/features/routine/lib/blocks';
import { istClock } from '@/lib/dates';
import { formatClock, formatIndianNumber } from '@/lib/format';

export type WaterEntry = { amount_ml: number; logged_at: string };
export type SessionInfo = { kind: string; completion: number | null; title?: string } | null;

export type AutoInputs = {
  /** Live water entries of the logical day. */
  water: readonly WaterEntry[];
  waterTargetMl: number;
  /** Meal slots with something eaten (portion > 0). */
  eatenSlots: ReadonlySet<string>;
  /** Today's workout session from the program, with its log if any. */
  session: SessionInfo;
};

export type AutoStatus = {
  done: boolean;
  /** When the condition was met (epoch ms), if known. */
  at: number | null;
  /** "auto: 500 ml", "auto: 500 ml at 5:12 am", "3,000 ml by 9:00 pm". */
  hint: string | null;
};

/** PRD F11: a session ≥ 80 % complete ticks the workout block. */
export const WORKOUT_DONE_PCT = 80;

const NONE: AutoStatus = { done: false, at: null, hint: null };

/** "Drink 500 ml water" → 500; no number → 500 (the seed's amount). */
export function drinkAmount(title: string): number {
  const m = /(\d[\d,]*)\s*ml/i.exec(title);
  const n = m ? Number((m[1] as string).replace(/,/g, '')) : NaN;
  return Number.isFinite(n) && n > 0 ? n : 500;
}

/** Moment the running total first reached `ml` (entries in time order), or null. */
export function reachedAt(entries: readonly WaterEntry[], ml: number): number | null {
  let total = 0;
  for (const e of [...entries].sort((a, b) => a.logged_at.localeCompare(b.logged_at))) {
    total += e.amount_ml;
    if (total >= ml) return Date.parse(e.logged_at);
  }
  return null;
}

const clock = (ms: number) => formatClock(istClock(ms));

/**
 * Auto-complete rules (PRD F05). Water: the day's last water block is the
 * "water target" (total ≥ target); earlier water blocks are drinks that need
 * the running total to reach every drink amount up to and including theirs
 * (so "500 ml at 05:15" ticks "Drink 500 ml"). Meal: anything eaten in its slot.
 * Workout: session ≥ 80 %, or a rest day.
 */
export function autoStatus(
  block: BlockLike,
  dayBlocks: readonly BlockLike[],
  inputs: AutoInputs,
): AutoStatus {
  if (!block.auto_complete) return NONE;
  switch (block.kind) {
    case 'water': {
      const waters = dayBlocks.filter((b) => b.kind === 'water' && !b.deleted_at);
      const target = waters[waters.length - 1];
      if (target && target.client_id === block.client_id) {
        const at = reachedAt(inputs.water, inputs.waterTargetMl);
        return {
          done: at !== null,
          at,
          hint: `${formatIndianNumber(inputs.waterTargetMl)} ml by ${formatClock(hhmm(block.start_time))}`,
        };
      }
      const upTo = waters.slice(0, waters.findIndex((b) => b.client_id === block.client_id) + 1);
      const needed = upTo.reduce((sum, b) => sum + drinkAmount(b.title), 0);
      const amount = drinkAmount(block.title);
      const at = reachedAt(inputs.water, needed);
      return {
        done: at !== null,
        at,
        hint: at !== null ? `auto: ${amount} ml at ${clock(at)}` : `auto: ${amount} ml`,
      };
    }
    case 'meal': {
      const done = block.ref_slot ? inputs.eatenSlots.has(block.ref_slot) : false;
      return { done, at: null, hint: done ? null : 'auto: when logged' };
    }
    case 'workout': {
      const s = inputs.session;
      if (!s) return NONE;
      if (s.kind === 'rest') return { done: true, at: null, hint: 'Rest day — nothing to do' };
      const done = (s.completion ?? 0) >= WORKOUT_DONE_PCT;
      return { done, at: null, hint: done ? null : `auto: session ${WORKOUT_DONE_PCT}%+` };
    }
    default:
      return NONE;
  }
}
