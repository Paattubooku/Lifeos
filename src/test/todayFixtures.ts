import { profileApi } from '@/features/profile/api';
import { progressApi } from '@/features/progress/api';
import { reviewApi } from '@/features/review/api';
import { stepsApi } from '@/features/steps/api';
import { tasksApi } from '@/features/tasks/api';
import { bodyApi } from '@/features/body/api';
import { foodApi } from '@/features/food/api';
import { todayApi } from '@/features/today/api';
import { trainApi } from '@/features/train/api';
import { waterApi } from '@/features/water/api';
import type { Json } from '@/types/supabase';
import { addDays, logicalMoment, weekStart } from '@/lib/dates';

import { seedMealPlan } from './foodFixtures';
import { base } from './profileFixtures';
import { routineStore } from './routineFixtures';

const PROGRAM_DAYS = [
  ['d1', 1, 'Upper A', 'strength'],
  ['d2', 2, 'Lower A', 'strength'],
  ['d3', 3, 'Walk', 'walk'],
  ['d4', 4, 'Upper B', 'strength'],
  ['d5', 5, 'Lower B', 'strength'],
  ['d6', 6, 'Full Body Circuit', 'circuit'],
  ['d7', 7, 'Rest', 'rest'],
] as const;

/**
 * Today's store: seeded routine, today pinned to Workday (day_log switch) and
 * to Upper A (session override), a lunch plan, nothing logged yet. Offline, so
 * every write stays in the queue. `at('05:20')` = that IST time today.
 */
export type TodayStoreOptions = {
  /** day_log history rows: [daysAgo, score, extra fields]. */
  history?: { daysAgo: number; score: number | null; template_id?: string | null }[];
  /** Ticked blocks per day for the finaliser / per-block streaks. */
  doneBlocks?: { daysAgo: number; blockId: string }[];
  /** Today's water entries: [IST HH:mm, ml]. */
  water?: [string, number][];
  /** Past days' water totals (one entry per day). */
  waterHistory?: { daysAgo: number; ml: number }[];
  /** Today's program day (session override), default Upper A ('d1'). */
  todaySession?: string;
  /** Weigh-ins: [daysAgo, kg, note?]. */
  weights?: [number, number, string?][];
  /** kcal logged per day: [daysAgo, kcal]. */
  intake?: [number, number][];
  /** Past sets: [daysAgo, exerciseId, setNo, weight, reps]. */
  pastSets?: [number, string, number, number | null, number | null][];
  /** Nights by the morning they end: [daysAgo (-1 = tomorrow), bed, wake, phoneOffKept]. */
  sleep?: [number, string | null, string | null, boolean | null][];
  /** Food per day for Progress: [daysAgo, kcal, protein g]. */
  nutrition?: [number, number, number][];
  /** Logged sessions for Progress (8 weeks): [daysAgo, completion %]. */
  sessions?: [number, number][];
  /** Weekly reviews (F20): week_start + fields. */
  reviews?: {
    week_start: string;
    change_next_week?: string | null;
    went_well?: string | null;
    grade?: string | null;
    summary?: Json;
  }[];
  /** Steps per day (F21): [daysAgo, steps, source?]. */
  steps?: [number, number, string?][];
  /** Tasks (F17); missing fields get defaults. */
  tasks?: Partial<TaskFixture>[];
};

type TaskFixture = {
  client_id: string;
  title: string;
  priority: string;
  due_date: string | null;
  is_top3: boolean;
  top3_date: string | null;
  status: string;
  done_at: string | null;
};

export async function todayStore(opts: TodayStoreOptions = {}) {
  const { store, today, blocks } = await routineStore();
  await store.dispatch(
    profileApi.util.upsertQueryData('getDayLog', today, {
      ...base,
      id: 'dl',
      client_id: 'dl-c',
      date: today,
      template_id: 'workday',
      score: null,
      is_streak_day: null,
      note: null,
    }),
  );
  const put = <E extends keyof typeof todayApi.endpoints>(
    endpoint: E,
    arg: unknown,
    data: unknown,
  ) =>
    store.dispatch(todayApi.util.upsertQueryData(endpoint as never, arg as never, data as never));
  await put('getBlockLogs', today, []);
  await put(
    'getWaterLogs',
    today,
    (opts.water ?? []).map(([hhmm, ml], i) => ({
      ...base,
      id: `w${i}`,
      client_id: `w${i}-c`,
      date: today,
      amount_ml: ml,
      logged_at: new Date(logicalMoment(today, hhmm)).toISOString(),
    })),
  );
  await put('getFoodLogs', today, []);
  await put('getSessionOn', today, null);
  const nights = (opts.sleep ?? []).map(([ago, bed, wake, kept]) => {
    const date = addDays(today, -ago);
    return {
      ...base,
      id: `sl${ago}`,
      client_id: `sl${ago}-c`,
      date,
      bed_at: bed ? new Date(logicalMoment(addDays(date, -1), bed)).toISOString() : null,
      wake_at: wake ? new Date(logicalMoment(date, wake)).toISOString() : null,
      phone_off_kept: kept,
    };
  });
  await put('getSleepOn', today, nights.find((n) => n.date === today) ?? null);
  await put('getSleepSince', addDays(today, -13), nights);
  await put('getOverridesSince', weekStart(today), [
    {
      ...base,
      id: 'o1',
      client_id: 'o1-c',
      date: today,
      workout_day_id: opts.todaySession ?? 'd1',
    },
  ]);
  await store.dispatch(foodApi.util.upsertQueryData('getMealPlan', undefined, seedMealPlan()));
  await store.dispatch(foodApi.util.upsertQueryData('getCoffeeLogs', today, []));
  await put('getProgramDays', 'prog', {
    days: PROGRAM_DAYS.map(([id, weekday, title, kind]) => ({
      id,
      program_id: 'prog',
      weekday,
      title,
      kind,
    })),
    exercises: ['DB bench press', 'One-arm DB row', 'Seated DB shoulder press'].map(
      (name, sort) => ({
        workout_day_id: 'd1',
        name,
        sort,
      }),
    ),
  });
  const history = (opts.history ?? []).map((h) => ({
    client_id: `h${h.daysAgo}-c`,
    date: addDays(today, -h.daysAgo),
    score: h.score,
    is_streak_day: h.score === null ? null : h.score >= 70,
    template_id: h.template_id ?? null,
    deleted_at: null,
  }));
  await put('getDayHistory', undefined, history);
  const done = (opts.doneBlocks ?? []).map((d, i) => ({
    ...base,
    id: `bl${i}`,
    client_id: `bl${i}-c`,
    date: addDays(today, -d.daysAgo),
    block_id: d.blockId,
    status: 'done',
    skip_reason: null,
    done_at: null,
  }));
  await put('getLogsSince', addDays(today, -8), {
    blockLogs: done,
    water: [],
    food: [],
    sessions: [],
  });
  await put('getDoneBlocksSince', addDays(today, -90), done);
  await store.dispatch(
    waterApi.util.upsertQueryData(
      'getWaterSince',
      addDays(today, -90),
      (opts.waterHistory ?? []).map((h) => ({
        client_id: `wh${h.daysAgo}-c`,
        date: addDays(today, -h.daysAgo),
        amount_ml: h.ml,
        deleted_at: null,
      })),
    ),
  );
  await store.dispatch(trainApi.util.upsertQueryData('getProgram', 'prog', TRAIN_PROGRAM));
  await store.dispatch(
    trainApi.util.upsertQueryData(
      'getSetLogsSince',
      addDays(today, -60),
      (opts.pastSets ?? []).map(([ago, ex, no, w, reps], i) => ({
        client_id: `ps${i}`,
        session_id: `past-${ago}`,
        date: addDays(today, -ago),
        exercise_id: ex,
        set_no: no,
        weight_kg: w,
        reps,
        duration_sec: null,
        created_at: '2026-11-01T00:00:00Z',
        deleted_at: null,
      })),
    ),
  );
  await store.dispatch(trainApi.util.upsertQueryData('getSessionsSince', addDays(today, -13), []));
  await store.dispatch(
    bodyApi.util.upsertQueryData(
      'getWeights',
      undefined,
      (opts.weights ?? []).map(([ago, kg, note], i) => ({
        ...base,
        id: `wt${i}`,
        client_id: `wt${ago}-c`,
        date: addDays(today, -ago),
        weight_kg: kg,
        note: note ?? null,
      })),
    ),
  );
  await store.dispatch(
    bodyApi.util.upsertQueryData('getIntakeSince', addDays(today, -29), {
      food: (opts.intake ?? []).map(([ago, kcal]) => ({
        client_id: `in${ago}`,
        date: addDays(today, -ago),
        kcal,
        deleted_at: null,
      })),
      coffee: [],
    }),
  );
  await store.dispatch(
    progressApi.util.upsertQueryData('getNutritionSince', addDays(today, -13), {
      food: (opts.nutrition ?? []).map(([ago, kcal, protein]) => ({
        client_id: `nu${ago}`,
        date: addDays(today, -ago),
        kcal,
        protein_g: protein,
        deleted_at: null,
      })),
      coffee: [],
    }),
  );
  await store.dispatch(
    trainApi.util.upsertQueryData(
      'getSessionsSince',
      addDays(weekStart(today), -49),
      (opts.sessions ?? []).map(([ago, completion]) => ({
        ...base,
        id: `ss${ago}`,
        client_id: `ss${ago}-c`,
        date: addDays(today, -ago),
        completion,
        started_at: null,
        finished_at: null,
        workout_day_id: null,
      })),
    ),
  );
  await store.dispatch(
    tasksApi.util.upsertQueryData(
      'getTasks',
      new Date(logicalMoment(addDays(today, -14), '03:00')).toISOString(),
      (opts.tasks ?? []).map((t, i) => ({
        ...base,
        id: `tk${i}`,
        client_id: `tk${i}`,
        title: `Task ${i}`,
        priority: 'medium',
        due_date: null,
        is_top3: false,
        top3_date: null,
        status: 'open',
        done_at: null,
        sort: 0,
        ...t,
      })),
    ),
  );
  await store.dispatch(
    reviewApi.util.upsertQueryData(
      'getReviews',
      undefined,
      (opts.reviews ?? []).map((r, i) => ({
        ...base,
        id: `rv${i}`,
        client_id: `rv${i}`,
        went_well: null,
        change_next_week: null,
        grade: null,
        summary: {},
        ...r,
      })),
    ),
  );
  await store.dispatch(
    stepsApi.util.upsertQueryData(
      'getStepsSince',
      addDays(today, -29),
      (opts.steps ?? []).map(([ago, steps, source]) => ({
        ...base,
        id: `st${ago}`,
        client_id: `st${ago}-c`,
        date: addDays(today, -ago),
        steps,
        source: source ?? 'manual',
      })),
    ),
  );
  const at = (hhmm: string) => logicalMoment(today, hhmm);
  return { store, today, blocks, at };
}

const ex = (id: string, name: string, muscle: string, equipment: string, unilateral = false) => ({
  id,
  name,
  muscle,
  equipment,
  unilateral,
  cue: `${name} cue`,
});
const wi = (
  day: string,
  exId: string,
  sets: number,
  rmin: number | null,
  rmax: number | null,
  rest: number,
  sort: number,
  dur: number | null = null,
) => ({
  id: `wi-${day}-${exId}`,
  client_id: `wc-${day}-${exId}`,
  workout_day_id: day,
  exercise_id: exId,
  sets,
  rep_min: rmin,
  rep_max: rmax,
  duration_sec: dur,
  rest_sec: rest,
  sort,
});

/** A trimmed PRD §6.4 program: Upper A (2 exercises), Lower A (plank), Walk, Circuit (2 stations × 2 rounds), Rest. */
export const TRAIN_PROGRAM = {
  days: [
    { id: 'd1', weekday: 1, title: 'Upper A', kind: 'strength', rounds: null },
    { id: 'd2', weekday: 2, title: 'Lower A', kind: 'strength', rounds: null },
    { id: 'd3', weekday: 3, title: 'Walk', kind: 'walk', rounds: null },
    { id: 'd4', weekday: 4, title: 'Upper B', kind: 'strength', rounds: null },
    { id: 'd5', weekday: 5, title: 'Lower B', kind: 'strength', rounds: null },
    { id: 'd6', weekday: 6, title: 'Full Body Circuit', kind: 'circuit', rounds: 2 },
    { id: 'd7', weekday: 7, title: 'Rest', kind: 'rest', rounds: null },
  ],
  items: [
    wi('d1', 'bench', 3, 8, 12, 90, 0),
    wi('d1', 'row', 2, 8, 12, 75, 1),
    wi('d2', 'plank', 2, 30, 45, 45, 0, 45),
    wi('d3', 'walk', 1, null, null, 0, 0, 1800),
    wi('d6', 'thruster', 2, 10, 10, 0, 0),
    wi('d6', 'pushup', 2, 10, 10, 60, 1),
  ],
  exercises: [
    ex('bench', 'DB bench press', 'chest', 'dumbbells + bench'),
    ex('row', 'One-arm DB row', 'back', 'dumbbell + bench', true),
    ex('plank', 'Plank', 'core', 'bodyweight'),
    ex('walk', 'Brisk walk', 'cardio', 'none'),
    ex('thruster', 'DB thruster', 'full body', 'dumbbells'),
    ex('pushup', 'Push-up', 'chest', 'bodyweight'),
  ],
};
