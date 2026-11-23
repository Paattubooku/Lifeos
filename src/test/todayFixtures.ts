import { profileApi } from '@/features/profile/api';
import { todayApi } from '@/features/today/api';
import { waterApi } from '@/features/water/api';
import { addDays, logicalMoment, weekStart } from '@/lib/dates';

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
  await put('getSleepOn', today, null);
  await put('getOverridesSince', weekStart(today), [
    { ...base, id: 'o1', client_id: 'o1-c', date: today, workout_day_id: 'd1' },
  ]);
  await put('getActiveMealPlan', undefined, {
    meals: [{ id: 'meal-lunch', slot: 'lunch', time: '13:00:00', plan_id: 'plan' }],
    items: [
      { meal_id: 'meal-lunch', dish_id: 'rice', swap_group: 'base', is_default: true, sort: 0 },
      { meal_id: 'meal-lunch', dish_id: 'curry', swap_group: 'curry', is_default: true, sort: 1 },
      { meal_id: 'meal-lunch', dish_id: 'roti', swap_group: 'base', is_default: false, sort: 2 },
    ],
    dishes: [
      { id: 'rice', name: 'Rice 1 cup', serving_text: '', kcal: 200, protein_g: 4 },
      { id: 'curry', name: 'Chicken curry', serving_text: '', kcal: 350, protein_g: 30 },
      { id: 'roti', name: 'Roti', serving_text: '', kcal: 100, protein_g: 3 },
    ],
  });
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
  const at = (hhmm: string) => logicalMoment(today, hhmm);
  return { store, today, blocks, at };
}
