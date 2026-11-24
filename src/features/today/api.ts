import { baseApi } from '@/store/baseApi';
import { supabaseQuery, unwrapList, unwrapOne } from '@/store/supabaseQuery';
import type { Tables } from '@/types/supabase';

export type BlockLogRow = Tables<'block_log'>;
export type WaterLogRow = Tables<'water_log'>;
export type FoodLogRow = Tables<'food_log'>;
export type SessionLogRow = Tables<'session_log'>;
export type OverrideRow = Tables<'session_override'>;
export type SleepLogRow = Tables<'sleep_log'>;

export type DayScoreRow = Pick<
  Tables<'day_log'>,
  'client_id' | 'date' | 'score' | 'is_streak_day' | 'template_id' | 'deleted_at'
>;

export type LogsSince = {
  blockLogs: BlockLogRow[];
  water: WaterLogRow[];
  food: FoodLogRow[];
  sessions: SessionLogRow[];
};

export type ProgramData = {
  days: Pick<Tables<'workout_day'>, 'id' | 'program_id' | 'weekday' | 'title' | 'kind'>[];
  exercises: { workout_day_id: string; name: string; sort: number }[];
};

export const todayApi = baseApi.injectEndpoints({
  endpoints: (b) => ({
    /** Includes deleted rows: (user, date, block) stays unique, so their client_id is reused. */
    getBlockLogs: b.query<BlockLogRow[], string>({
      queryFn: (date, api) =>
        supabaseQuery(api, ['block_log'], async (c) =>
          unwrapList(await c.from('block_log').select('*').eq('date', date)),
        ),
      providesTags: ['BlockLog'],
    }),

    getWaterLogs: b.query<WaterLogRow[], string>({
      queryFn: (date, api) =>
        supabaseQuery(api, ['water_log'], async (c) =>
          unwrapList(
            await c
              .from('water_log')
              .select('*')
              .eq('date', date)
              .is('deleted_at', null)
              .order('logged_at'),
          ),
        ),
      providesTags: ['Water'],
    }),

    getFoodLogs: b.query<FoodLogRow[], string>({
      queryFn: (date, api) =>
        supabaseQuery(api, ['food_log'], async (c) =>
          unwrapList(await c.from('food_log').select('*').eq('date', date).is('deleted_at', null)),
        ),
      providesTags: ['Food'],
    }),

    getProgramDays: b.query<ProgramData, string>({
      queryFn: (programId, api) =>
        supabaseQuery(api, ['workout_day', 'workout_exercise', 'exercise'], async (c) => {
          const days = unwrapList(
            await c
              .from('workout_day')
              .select('id, program_id, weekday, title, kind')
              .eq('program_id', programId)
              .is('deleted_at', null),
          );
          const links = unwrapList(
            await c
              .from('workout_exercise')
              .select('workout_day_id, exercise_id, sort')
              .is('deleted_at', null),
          );
          const names = unwrapList(
            await c.from('exercise').select('id, name').is('deleted_at', null),
          );
          const nameOf = new Map(names.map((e) => [e.id, e.name]));
          const dayIds = new Set(days.map((d) => d.id));
          return {
            days,
            exercises: links
              .filter((l) => dayIds.has(l.workout_day_id))
              .map((l) => ({
                workout_day_id: l.workout_day_id,
                name: nameOf.get(l.exercise_id) ?? '',
                sort: l.sort,
              })),
          };
        }),
      providesTags: ['Program'],
    }),

    getSessionOn: b.query<SessionLogRow | null, string>({
      queryFn: (date, api) =>
        supabaseQuery(api, ['session_log'], async (c) =>
          unwrapOne(await c.from('session_log').select('*').eq('date', date).maybeSingle()),
        ),
      providesTags: ['Session'],
    }),

    /** From a date on, deleted rows included (unique per user/date). */
    getOverridesSince: b.query<OverrideRow[], string>({
      queryFn: (from, api) =>
        supabaseQuery(api, ['session_override'], async (c) =>
          unwrapList(await c.from('session_override').select('*').gte('date', from)),
        ),
      providesTags: ['Session'],
    }),

    /** Every day_log's score (one small row per day) — streaks and the heatmap. Deleted rows included (unique per day). */
    getDayHistory: b.query<DayScoreRow[], void>({
      queryFn: (_arg, api) =>
        supabaseQuery(api, ['day_log'], async (c) =>
          unwrapList(
            await c
              .from('day_log')
              .select('client_id, date, score, is_streak_day, template_id, deleted_at')
              .order('date'),
          ),
        ),
      providesTags: ['DayLog'],
    }),

    /** Logs from a date on — to finalise past days' scores and per-block streaks. */
    getLogsSince: b.query<LogsSince, string>({
      queryFn: (from, api) =>
        supabaseQuery(api, ['block_log', 'water_log', 'food_log', 'session_log'], async (c) => ({
          blockLogs: unwrapList(await c.from('block_log').select('*').gte('date', from)),
          water: unwrapList(
            await c.from('water_log').select('*').gte('date', from).is('deleted_at', null),
          ),
          food: unwrapList(
            await c.from('food_log').select('*').gte('date', from).is('deleted_at', null),
          ),
          sessions: unwrapList(
            await c.from('session_log').select('*').gte('date', from).is('deleted_at', null),
          ),
        })),
      providesTags: ['BlockLog', 'Water', 'Food', 'Session'],
    }),

    /** Ticked blocks from a date on (per-block streaks in the routine editor). */
    getDoneBlocksSince: b.query<
      Pick<BlockLogRow, 'client_id' | 'block_id' | 'date' | 'status' | 'deleted_at'>[],
      string
    >({
      queryFn: (from, api) =>
        supabaseQuery(api, ['block_log'], async (c) =>
          unwrapList(
            await c
              .from('block_log')
              .select('client_id, block_id, date, status, deleted_at')
              .gte('date', from)
              .eq('status', 'done')
              .is('deleted_at', null),
          ),
        ),
      providesTags: ['BlockLog'],
    }),

    getSleepOn: b.query<SleepLogRow | null, string>({
      queryFn: (date, api) =>
        supabaseQuery(api, ['sleep_log'], async (c) =>
          unwrapOne(await c.from('sleep_log').select('*').eq('date', date).maybeSingle()),
        ),
      providesTags: ['Sleep'],
    }),

    /** F14: nights from `from` on (includes tomorrow's phone-away row). */
    getSleepSince: b.query<SleepLogRow[], string>({
      queryFn: (from, api) =>
        supabaseQuery(api, ['sleep_log'], async (c) =>
          unwrapList(await c.from('sleep_log').select('*').gte('date', from).order('date')),
        ),
      providesTags: ['Sleep'],
    }),
  }),
});

export const {
  useGetBlockLogsQuery,
  useGetWaterLogsQuery,
  useGetFoodLogsQuery,
  useGetProgramDaysQuery,
  useGetSessionOnQuery,
  useGetOverridesSinceQuery,
  useGetSleepOnQuery,
  useGetSleepSinceQuery,
  useGetDayHistoryQuery,
  useGetLogsSinceQuery,
  useGetDoneBlocksSinceQuery,
} = todayApi;
