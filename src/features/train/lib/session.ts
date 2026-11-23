import type { Change } from '@/features/routine/lib/changes';
import type { DateString } from '@/lib/dates';

import { targetReps, type WorkoutItem } from './program';

export type SetLogRow = {
  client_id: string;
  session_id: string;
  date: DateString;
  exercise_id: string;
  set_no: number;
  weight_kg: number | string | null;
  reps: number | null;
  duration_sec: number | null;
  created_at?: string;
  deleted_at?: string | null;
};

export type SessionRow = {
  id: string;
  client_id: string;
  date: DateString;
  workout_day_id: string | null;
  started_at: string | null;
  finished_at: string | null;
  completion: number | null;
  deleted_at?: string | null;
};

const live = <T extends { deleted_at?: string | null }>(rows: readonly T[]) =>
  rows.filter((r) => !r.deleted_at);

/** One exercise's sets in this session, by set number (a re-logged set replaces the earlier one). */
export function setsOf(
  logs: readonly SetLogRow[],
  sessionId: string,
  exerciseId: string,
): SetLogRow[] {
  const byNo = new Map<number, SetLogRow>();
  for (const l of live(logs))
    if (l.session_id === sessionId && l.exercise_id === exerciseId) byNo.set(l.set_no, l);
  return [...byNo.values()].sort((a, b) => a.set_no - b.set_no);
}

/** The latest earlier day's sets for an exercise ("Last time (Mon 16)"). */
export function lastTime(
  logs: readonly SetLogRow[],
  exerciseId: string,
  before: DateString,
): { date: DateString; sets: SetLogRow[] } | null {
  const past = live(logs).filter((l) => l.exercise_id === exerciseId && l.date < before);
  if (past.length === 0) return null;
  const date = past
    .map((l) => l.date)
    .sort()
    .at(-1) as DateString;
  return { date, sets: past.filter((l) => l.date === date).sort((a, b) => a.set_no - b.set_no) };
}

export type Prefill = {
  weight: number;
  reps: number;
  duration: number;
  source: 'this' | 'last' | 'plan';
};

/**
 * F11 AC1: the next set starts from this session's previous set; the first set
 * from last time's same set; otherwise the plan's target.
 */
export function prefill(
  item: WorkoutItem,
  done: readonly SetLogRow[],
  last: readonly SetLogRow[] | null,
): Prefill {
  const prev = done.at(-1);
  if (prev)
    return {
      weight: Number(prev.weight_kg ?? 0),
      reps: prev.reps ?? targetReps(item),
      duration: prev.duration_sec ?? item.rep_max ?? item.duration_sec ?? 30,
      source: 'this',
    };
  const same = last?.find((l) => l.set_no === done.length + 1) ?? last?.at(-1);
  if (same)
    return {
      weight: Number(same.weight_kg ?? 0),
      reps: same.reps ?? targetReps(item),
      duration: same.duration_sec ?? item.rep_max ?? item.duration_sec ?? 30,
      source: 'last',
    };
  return {
    weight: 0,
    reps: targetReps(item),
    duration: item.rep_max ?? item.duration_sec ?? 30,
    source: 'plan',
  };
}

/** PRD F11: completion = logged sets ÷ planned sets × 100 (extra sets don't count twice). */
export function completion(
  items: readonly WorkoutItem[],
  logs: readonly SetLogRow[],
  sessionId: string,
): number {
  const planned = items.reduce((s, i) => s + i.sets, 0);
  if (planned === 0) return 0;
  const logged = items.reduce(
    (s, i) => s + Math.min(i.sets, setsOf(logs, sessionId, i.exercise_id).length),
    0,
  );
  return Math.round((logged / planned) * 100);
}

/** First exercise with sets left (or -1 when everything is logged). */
export function currentIndex(
  items: readonly WorkoutItem[],
  logs: readonly SetLogRow[],
  sessionId: string,
): number {
  return items.findIndex((i) => setsOf(logs, sessionId, i.exercise_id).length < i.sets);
}

/** Circuit: the round in progress and its next station (stations = items, rounds = sets). */
export function circuitPosition(
  items: readonly WorkoutItem[],
  logs: readonly SetLogRow[],
  sessionId: string,
) {
  const counts = items.map((i) => setsOf(logs, sessionId, i.exercise_id).length);
  const rounds = items[0]?.sets ?? 0;
  const round = Math.min(...counts, rounds) + 1;
  if (items.length === 0 || round > rounds)
    return { round: rounds, rounds, station: -1, done: true };
  return { round, rounds, station: counts.findIndex((c) => c < round), done: false };
}

export const volume = (logs: readonly SetLogRow[]) =>
  live(logs).reduce((s, l) => s + Number(l.weight_kg ?? 0) * (l.reps ?? 0), 0);

export function planStartSession(
  date: DateString,
  dayId: string,
  existing: SessionRow | null,
  ids: { sessionId: string },
  now: number,
): { sessionId: string; changes: Change[] } {
  if (existing && !existing.deleted_at) {
    if (existing.started_at) return { sessionId: existing.id, changes: [] };
    return {
      sessionId: existing.id,
      changes: [
        {
          op: 'upsert',
          table: 'session_log',
          clientId: existing.client_id,
          row: { started_at: new Date(now).toISOString() },
        },
      ],
    };
  }
  const id = existing?.id ?? ids.sessionId;
  return {
    sessionId: id,
    changes: [
      {
        op: 'upsert',
        table: 'session_log',
        ...(existing ? { clientId: existing.client_id } : {}),
        row: {
          id,
          date,
          workout_day_id: dayId,
          started_at: new Date(now).toISOString(),
          finished_at: null,
          completion: 0,
          deleted_at: null,
        },
      },
    ],
  };
}

/**
 * Log one set (replacing a re-logged set number) and keep the session's
 * completion current, so ≥ 80 % ticks Today's workout block (F11 AC3).
 */
export function planLogSet(
  ctx: {
    session: SessionRow;
    items: readonly WorkoutItem[];
    logs: readonly SetLogRow[];
    date: DateString;
  },
  set: {
    exerciseId: string;
    setNo: number;
    weight: number | null;
    reps: number | null;
    duration: number | null;
  },
): Change[] {
  const existing = setsOf(ctx.logs, ctx.session.id, set.exerciseId).find(
    (l) => l.set_no === set.setNo,
  );
  const row = {
    session_id: ctx.session.id,
    date: ctx.date,
    exercise_id: set.exerciseId,
    set_no: set.setNo,
    weight_kg: set.weight,
    reps: set.reps,
    duration_sec: set.duration,
    deleted_at: null,
  };
  const after: SetLogRow[] = [
    ...ctx.logs.filter((l) => l.client_id !== existing?.client_id),
    { ...row, client_id: existing?.client_id ?? 'pending' },
  ];
  return [
    { op: 'upsert', table: 'set_log', ...(existing ? { clientId: existing.client_id } : {}), row },
    {
      op: 'upsert',
      table: 'session_log',
      clientId: ctx.session.client_id,
      row: { completion: completion(ctx.items, after, ctx.session.id) },
    },
  ];
}

export function planFinish(
  session: SessionRow,
  items: readonly WorkoutItem[],
  logs: readonly SetLogRow[],
  now: number,
): Change[] {
  return [
    {
      op: 'upsert',
      table: 'session_log',
      clientId: session.client_id,
      row: {
        finished_at: new Date(now).toISOString(),
        completion: completion(items, logs, session.id),
      },
    },
  ];
}

/** Walk day "Done (30 min)": a finished session at 100 %. */
export function planWalkDone(
  date: DateString,
  dayId: string,
  existing: SessionRow | null,
  sessionId: string,
  now: number,
): Change[] {
  const iso = new Date(now).toISOString();
  return [
    {
      op: 'upsert',
      table: 'session_log',
      ...(existing ? { clientId: existing.client_id } : {}),
      row: {
        ...(existing ? {} : { id: sessionId }),
        date,
        workout_day_id: dayId,
        started_at: existing?.started_at ?? iso,
        finished_at: iso,
        completion: 100,
        deleted_at: null,
      },
    },
  ];
}

/** Per-exercise summary line: "14×12 · 14×11" or "42 s · 38 s". */
export function setsText(sets: readonly SetLogRow[]): string {
  return sets
    .map((s) =>
      s.duration_sec !== null && s.reps === null
        ? `${s.duration_sec} s`
        : Number(s.weight_kg ?? 0) > 0
          ? `${Number(s.weight_kg)}×${s.reps ?? 0}`
          : `${s.reps ?? 0}`,
    )
    .join(' · ');
}
