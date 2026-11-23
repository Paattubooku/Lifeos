import type { DateString } from '@/lib/dates';

import { MAX_WEIGHT_KG, type WorkoutItem } from './program';
import type { SetLogRow } from './session';

export type Suggestion =
  /** Every working set hit rep_max: +1 kg (+0.5 kg under 10 kg). */
  | { kind: 'add_weight'; weight: number; from: number; text: string }
  /** Already at 20 kg (or bodyweight): aim one rep past the range, lower slowly. */
  | { kind: 'add_rep'; reps: number; weight: number; text: string; cue: string }
  /** Two or more sets missed rep_min: keep the weight. */
  | { kind: 'same'; weight: number; text: string };

export const TEMPO_CUE = 'Slow 3-second lowering';

const num = (v: number | string | null | undefined) => Number(v ?? 0);

/**
 * PRD F12, from last session's sets of one exercise (timed exercises don't
 * progress by weight). Returns null when there's nothing to change.
 */
export function suggestNext(
  item: WorkoutItem,
  last: readonly SetLogRow[] | null,
): Suggestion | null {
  if (!last || last.length === 0 || item.duration_sec) return null;
  const sets = last.filter((s) => s.reps !== null);
  if (sets.length === 0) return null;
  const weight = Math.max(...sets.map((s) => num(s.weight_kg)));
  const top = item.rep_max;
  const allTop =
    top !== null && sets.length >= item.sets && sets.every((s) => (s.reps ?? 0) >= top);
  if (allTop) {
    if (weight > 0 && weight < MAX_WEIGHT_KG) {
      const next = Math.min(MAX_WEIGHT_KG, weight + (weight < 10 ? 0.5 : 1));
      return { kind: 'add_weight', weight: next, from: weight, text: `Try ${next} kg` };
    }
    const reps = (top as number) + 1;
    return {
      kind: 'add_rep',
      reps,
      weight,
      text: `Try ${reps} reps`,
      cue: TEMPO_CUE,
    };
  }
  const min = item.rep_min;
  if (min !== null && sets.filter((s) => (s.reps ?? 0) < min).length >= 2)
    return { kind: 'same', weight, text: weight > 0 ? `Stay at ${weight} kg` : 'Same again' };
  return null;
}

/** "Every set hit 12 last time." / "2 sets missed 8 last time." */
export function suggestionReason(s: Suggestion, item: WorkoutItem): string {
  if (s.kind === 'same') return `2+ sets missed ${item.rep_min} last time.`;
  if (s.kind === 'add_rep')
    return `Every set hit ${item.rep_max} at ${s.weight > 0 ? `${s.weight} kg (the cap)` : 'bodyweight'}. ${s.cue}.`;
  return `Every set hit ${item.rep_max} last time at ${s.from} kg.`;
}

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------

/** Epley estimated 1-rep max: w × (1 + reps / 30). */
export const epley = (weight: number, reps: number) =>
  weight > 0 && reps > 0 ? weight * (1 + reps / 30) : 0;

export type SessionHistory = {
  date: DateString;
  sets: SetLogRow[];
  best: SetLogRow;
  e1rm: number;
  volume: number;
};

/** One row per day the exercise was done, newest first; best set by est. 1RM. */
export function exerciseHistory(logs: readonly SetLogRow[], exerciseId: string): SessionHistory[] {
  const byDate = new Map<DateString, SetLogRow[]>();
  for (const l of logs) {
    if (l.deleted_at || l.exercise_id !== exerciseId) continue;
    byDate.set(l.date, [...(byDate.get(l.date) ?? []), l]);
  }
  return [...byDate.entries()]
    .map(([date, sets]) => {
      const sorted = [...sets].sort((a, b) => a.set_no - b.set_no);
      const best = sorted.reduce((b, s) => {
        const e = epley(num(s.weight_kg), s.reps ?? 0);
        const eb = epley(num(b.weight_kg), b.reps ?? 0);
        return e > eb || (e === eb && (s.reps ?? 0) > (b.reps ?? 0)) ? s : b;
      });
      return {
        date,
        sets: sorted,
        best,
        e1rm: Math.round(epley(num(best.weight_kg), best.reps ?? 0) * 10) / 10,
        volume: sorted.reduce((v, s) => v + num(s.weight_kg) * (s.reps ?? 0), 0),
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}

/** % change of est. 1RM between the first session in the last 8 weeks and the latest. */
export function changePct(
  history: readonly SessionHistory[],
  today: DateString,
  since: DateString,
): number | null {
  const window = history.filter((h) => h.date >= since && h.date <= today && h.e1rm > 0);
  if (window.length < 2) return null;
  const first = window.at(-1)!.e1rm;
  const last = window[0]!.e1rm;
  return Math.round(((last - first) / first) * 100);
}
