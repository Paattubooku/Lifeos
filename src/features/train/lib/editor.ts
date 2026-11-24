import type { Change } from '@/features/routine/lib/changes';

import { isTimed, type WorkoutItem } from './program';

/** One exercise row in the program editor (Train-ProgramEditor design). */
export type DraftItem = {
  /** Stable key in the list: the row's client_id, or a new one. */
  key: string;
  isNew: boolean;
  id: string;
  exercise_id: string;
  sets: number;
  rep_min: number | null;
  rep_max: number | null;
  duration_sec: number | null;
  rest_sec: number;
};

export const REST_CHOICES = [30, 45, 60, 90, 120, 180] as const;
export const LIMITS = { sets: [1, 10], reps: [1, 50], seconds: [5, 3600], rest: [0, 600] } as const;

export function toDraft(items: readonly WorkoutItem[]): DraftItem[] {
  return [...items]
    .filter((i) => !i.deleted_at)
    .sort((a, b) => a.sort - b.sort)
    .map((i) => ({
      key: i.client_id ?? i.id,
      isNew: false,
      id: i.id,
      exercise_id: i.exercise_id,
      sets: i.sets,
      rep_min: i.rep_min,
      rep_max: i.rep_max,
      duration_sec: i.duration_sec,
      rest_sec: i.rest_sec,
    }));
}

/** A new row for an exercise picked from the library: 3 × 8–12, rest 90 s. */
export function newDraft(exerciseId: string, ids: { clientId: string; id: string }): DraftItem {
  return {
    key: ids.clientId,
    isNew: true,
    id: ids.id,
    exercise_id: exerciseId,
    sets: 3,
    rep_min: 8,
    rep_max: 12,
    duration_sec: null,
    rest_sec: 90,
  };
}

/** Problems that block saving, by row key. */
export function validate(draft: readonly DraftItem[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const d of draft) {
    if (d.sets < LIMITS.sets[0] || d.sets > LIMITS.sets[1]) out.set(d.key, 'Sets must be 1–10.');
    else if (d.rep_min !== null && d.rep_max !== null && d.rep_min > d.rep_max)
      out.set(d.key, 'The low end of the range is above the high end.');
    else if (d.rest_sec < LIMITS.rest[0] || d.rest_sec > LIMITS.rest[1])
      out.set(d.key, 'Rest must be 0–600 s.');
  }
  return out;
}

const FIELDS = ['exercise_id', 'sets', 'rep_min', 'rep_max', 'duration_sec', 'rest_sec'] as const;

/**
 * Writes that turn the saved day into the draft: changed fields and order on
 * existing rows, new rows (server id made here so sessions can refer to it),
 * soft-deletes for removed rows. Nothing for an unchanged day.
 */
export function planDayEdit(
  dayId: string,
  original: readonly WorkoutItem[],
  draft: readonly DraftItem[],
): Change[] {
  const out: Change[] = [];
  const kept = new Set(draft.filter((d) => !d.isNew).map((d) => d.key));
  for (const o of original)
    if (!o.deleted_at && o.client_id && !kept.has(o.client_id))
      out.push({ op: 'delete', table: 'workout_exercise', clientId: o.client_id });
  draft.forEach((d, sort) => {
    if (d.isNew) {
      out.push({
        op: 'upsert',
        table: 'workout_exercise',
        clientId: d.key,
        row: {
          id: d.id,
          workout_day_id: dayId,
          ...Object.fromEntries(FIELDS.map((f) => [f, d[f]])),
          sort,
          deleted_at: null,
        },
      });
      return;
    }
    const o = original.find((x) => x.client_id === d.key);
    if (!o) return;
    const row: Record<string, unknown> = {};
    for (const f of FIELDS) if (o[f] !== d[f]) row[f] = d[f];
    if (o.sort !== sort) row.sort = sort;
    if (Object.keys(row).length)
      out.push({ op: 'upsert', table: 'workout_exercise', clientId: d.key, row });
  });
  return out;
}

/** "4 × 8–12 · rest 90 s" for a collapsed row. */
export function draftSummary(d: DraftItem): string {
  const range = isTimed(d)
    ? `${d.duration_sec} s`
    : d.rep_min === null && d.rep_max === null
      ? 'max'
      : d.rep_min === d.rep_max || d.rep_max === null
        ? String(d.rep_min ?? d.rep_max)
        : `${d.rep_min}–${d.rep_max}`;
  return `${d.sets} × ${range} · rest ${d.rest_sec} s`;
}
