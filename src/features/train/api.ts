import { baseApi } from '@/store/baseApi';
import { supabaseQuery, unwrapList } from '@/store/supabaseQuery';

import type { ExerciseRow, WorkoutDayRow, WorkoutItem } from './lib/program';
import type { SessionRow, SetLogRow } from './lib/session';

export type ProgramFull = { days: WorkoutDayRow[]; items: WorkoutItem[]; exercises: ExerciseRow[] };

export const trainApi = baseApi.injectEndpoints({
  endpoints: (b) => ({
    /** The program's days, their exercises (sets/reps/rest) and the exercise library. */
    getProgram: b.query<ProgramFull, string>({
      queryFn: (programId, api) =>
        supabaseQuery(api, ['workout_day', 'workout_exercise', 'exercise'], async (c) => {
          const days = unwrapList(
            await c
              .from('workout_day')
              .select('id, weekday, title, kind, rounds')
              .eq('program_id', programId)
              .is('deleted_at', null),
          );
          const ids = new Set(days.map((d) => d.id));
          const items = unwrapList(
            await c
              .from('workout_exercise')
              .select(
                'id, workout_day_id, exercise_id, sets, rep_min, rep_max, duration_sec, rest_sec, sort',
              )
              .is('deleted_at', null),
          ).filter((i) => ids.has(i.workout_day_id));
          const exercises = unwrapList(
            await c
              .from('exercise')
              .select('id, name, muscle, equipment, unilateral, cue')
              .is('deleted_at', null)
              .order('name'),
          );
          return { days, items, exercises };
        }),
      providesTags: ['Program'],
    }),

    /** Sets from a date on (last time's numbers, 7-day volume). */
    getSetLogsSince: b.query<SetLogRow[], string>({
      queryFn: (from, api) =>
        supabaseQuery(api, ['set_log'], async (c) =>
          unwrapList(await c.from('set_log').select('*').gte('date', from).is('deleted_at', null)),
        ),
      providesTags: ['Session'],
    }),

    /** Sessions from a date on; deleted rows kept (one per day, client_id reused). */
    getSessionsSince: b.query<SessionRow[], string>({
      queryFn: (from, api) =>
        supabaseQuery(api, ['session_log'], async (c) =>
          unwrapList(await c.from('session_log').select('*').gte('date', from)),
        ),
      providesTags: ['Session'],
    }),
    /** Every set ever logged for one exercise (history screen). */
    getExerciseSets: b.query<SetLogRow[], string>({
      queryFn: (exerciseId, api) =>
        supabaseQuery(api, ['set_log'], async (c) =>
          unwrapList(
            await c
              .from('set_log')
              .select('*')
              .eq('exercise_id', exerciseId)
              .is('deleted_at', null)
              .order('date'),
          ),
        ),
      providesTags: ['Session'],
    }),
  }),
});

export const {
  useGetProgramQuery,
  useGetSetLogsSinceQuery,
  useGetSessionsSinceQuery,
  useGetExerciseSetsQuery,
} = trainApi;
