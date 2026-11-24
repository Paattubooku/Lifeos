import { baseApi } from '@/store/baseApi';
import { supabaseQuery, unwrapList } from '@/store/supabaseQuery';
import type { Tables } from '@/types/supabase';

export type StepsLogRow = Tables<'steps_log'>;

export const stepsApi = baseApi.injectEndpoints({
  endpoints: (b) => ({
    /** Steps per day from a date on; deleted rows kept (one per day, client_id reused). */
    getStepsSince: b.query<StepsLogRow[], string>({
      queryFn: (from, api) =>
        supabaseQuery(api, ['steps_log'], async (c) =>
          unwrapList(await c.from('steps_log').select('*').gte('date', from)),
        ),
      providesTags: ['Steps'],
    }),
  }),
});

export const { useGetStepsSinceQuery } = stepsApi;
