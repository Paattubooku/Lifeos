import type { DateString } from '@/lib/dates';

export type ExerciseRow = {
  id: string;
  name: string;
  muscle: string;
  equipment: string;
  unilateral: boolean;
  cue: string;
};

export type WorkoutItem = {
  id: string;
  workout_day_id: string;
  exercise_id: string;
  sets: number;
  /** Reps range; for timed exercises the seconds range (F01 decision). Both null = "max". */
  rep_min: number | null;
  rep_max: number | null;
  duration_sec: number | null;
  rest_sec: number;
  sort: number;
  deleted_at?: string | null;
};

export type WorkoutDayRow = {
  id: string;
  weekday: number;
  title: string;
  kind: string;
  rounds: number | null;
};

/** Per hand (PRD F11). */
export const MAX_WEIGHT_KG = 20;
/** Assumed working time per set, for the time estimate. */
export const WORK_SEC_PER_SET = 40;

/** 0.5 kg steps below 10 kg, 1 kg from 10 up (PRD F11, DESIGN_NOTES B6). */
export function weightStep(value: number, direction: 1 | -1): number {
  return direction > 0 ? (value < 10 ? 0.5 : 1) : value <= 10 ? 0.5 : 1;
}

export const isTimed = (i: Pick<WorkoutItem, 'duration_sec'>) =>
  i.duration_sec !== null && i.duration_sec > 0;
export const isBodyweight = (e: Pick<ExerciseRow, 'equipment'> | undefined) =>
  !e || e.equipment === 'bodyweight' || e.equipment === 'none';

/** "4 × 8–12", "3 × 10", "3 × max", "3 × 30–45 s", "+ / side" for unilateral. */
export function targetText(i: WorkoutItem, ex?: Pick<ExerciseRow, 'unilateral'>): string {
  const range =
    i.rep_min === null && i.rep_max === null
      ? isTimed(i)
        ? `${i.duration_sec} s`
        : 'max'
      : i.rep_min === i.rep_max || i.rep_max === null
        ? String(i.rep_min ?? i.rep_max)
        : `${i.rep_min}–${i.rep_max}`;
  const unit = isTimed(i) && (i.rep_min !== null || i.rep_max !== null) ? ' s' : '';
  return `${i.sets} × ${range}${unit}${ex?.unilateral ? ' / side' : ''}`;
}

/** Reps (or seconds) aimed at for a set: the bottom of the range, max ⇒ 10. */
export const targetReps = (i: WorkoutItem) => i.rep_min ?? i.rep_max ?? 10;

export function itemsOf(items: readonly WorkoutItem[], dayId: string): WorkoutItem[] {
  return items
    .filter((i) => i.workout_day_id === dayId && !i.deleted_at)
    .sort((a, b) => a.sort - b.sort);
}

export const plannedSets = (items: readonly WorkoutItem[]) => items.reduce((s, i) => s + i.sets, 0);

/** "~55 min": sets × (work + rest); a walk is its duration. Rounded to 5 min. */
export function estMinutes(items: readonly WorkoutItem[]): number {
  const sec = items.reduce(
    (s, i) =>
      s +
      (isTimed(i) && i.sets === 1 && i.rest_sec === 0
        ? (i.duration_sec ?? 0)
        : i.sets *
          ((isTimed(i) ? (i.rep_max ?? i.duration_sec ?? 0) : WORK_SEC_PER_SET) + i.rest_sec)),
    0,
  );
  return Math.max(5, Math.round(sec / 60 / 5) * 5);
}

const SHORT: Record<string, string> = {
  'DB bench press': 'Bench',
  'One-arm DB row': 'Row',
  'Seated DB shoulder press': 'Press',
  'Overhead DB triceps extension': 'Triceps',
  'DB Romanian deadlift': 'RDL',
  'Incline DB press': 'Incline',
  'Chest-supported DB row': 'Row',
  'Bulgarian split squat': 'Split squat',
  'DB hip thrust': 'Hip thrust',
  'Step-up on bench': 'Step-up',
  'Single-leg RDL': 'SL RDL',
  'Standing calf raise': 'Calf raise',
  'DB skull crusher': 'Skull crusher',
  'DB thruster': 'Thruster',
};

/** Tab label for the session's exercise strip ("Bench", "Row"…). */
export const shortName = (name: string) =>
  SHORT[name] ?? name.replace(/^DB /, '').split(' ').slice(0, 2).join(' ');

export type DayRef = { date: DateString; day: WorkoutDayRow | null };
