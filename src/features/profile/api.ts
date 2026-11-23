import { baseApi } from '@/store/baseApi';
import { supabaseQuery, unwrapList, unwrapOne } from '@/store/supabaseQuery';
import type { Tables } from '@/types/supabase';

export type ProfileRow = Tables<'profile'>;
export type RoutineTemplateRow = Tables<'routine_template'>;
export type RoutineBlockRow = Tables<'routine_block'>;
export type DayLogRow = Tables<'day_log'>;
export type WeightLogRow = Tables<'weight_log'>;
export type ProgramRow = Tables<'workout_program'>;

export const profileApi = baseApi.injectEndpoints({
  endpoints: (b) => ({
    getProfile: b.query<ProfileRow | null, void>({
      queryFn: (_arg, api) =>
        supabaseQuery(api, ['profile'], async (c) =>
          unwrapOne(await c.from('profile').select('*').is('deleted_at', null).maybeSingle()),
        ),
      providesTags: ['Profile'],
    }),

    getRoutine: b.query<{ templates: RoutineTemplateRow[]; blocks: RoutineBlockRow[] }, void>({
      queryFn: (_arg, api) =>
        supabaseQuery(api, ['routine_template', 'routine_block'], async (c) => ({
          templates: unwrapList(
            await c.from('routine_template').select('*').is('deleted_at', null).order('sort'),
          ),
          blocks: unwrapList(
            await c.from('routine_block').select('*').is('deleted_at', null).order('start_time'),
          ),
        })),
      providesTags: ['Routine'],
    }),

    /** Includes a soft-deleted row: (user_id, date) is unique even then. */
    getDayLog: b.query<DayLogRow | null, string>({
      queryFn: (date, api) =>
        supabaseQuery(api, ['day_log'], async (c) =>
          unwrapOne(await c.from('day_log').select('*').eq('date', date).maybeSingle()),
        ),
      providesTags: ['DayLog'],
    }),

    /** Includes a soft-deleted row (see getDayLog). */
    getWeightOn: b.query<WeightLogRow | null, string>({
      queryFn: (date, api) =>
        supabaseQuery(api, ['weight_log'], async (c) =>
          unwrapOne(await c.from('weight_log').select('*').eq('date', date).maybeSingle()),
        ),
      providesTags: ['Weight'],
    }),

    getLatestWeight: b.query<WeightLogRow | null, void>({
      queryFn: (_arg, api) =>
        supabaseQuery(api, ['weight_log'], async (c) =>
          unwrapOne(
            await c
              .from('weight_log')
              .select('*')
              .is('deleted_at', null)
              .order('date', { ascending: false })
              .limit(1)
              .maybeSingle(),
          ),
        ),
      providesTags: ['Weight'],
    }),

    getActiveProgram: b.query<ProgramRow | null, void>({
      queryFn: (_arg, api) =>
        supabaseQuery(api, ['workout_program'], async (c) =>
          unwrapOne(
            await c
              .from('workout_program')
              .select('*')
              .eq('is_active', true)
              .is('deleted_at', null)
              .limit(1)
              .maybeSingle(),
          ),
        ),
      providesTags: ['Program'],
    }),
  }),
});

export const {
  useGetProfileQuery,
  useGetRoutineQuery,
  useGetDayLogQuery,
  useGetWeightOnQuery,
  useGetLatestWeightQuery,
  useGetActiveProgramQuery,
} = profileApi;
