import { baseApi } from '@/store/baseApi';
import { supabaseQuery, unwrapList } from '@/store/supabaseQuery';
import type { Tables } from '@/types/supabase';

export type NudgeLogRow = Tables<'nudge_log'>;

export const nudgesApi = baseApi.injectEndpoints({
  endpoints: (b) => ({
    /** Nudges shown / acted on from a date on (limits: per day, per 7 days). */
    getNudgesSince: b.query<NudgeLogRow[], string>({
      queryFn: (from, api) =>
        supabaseQuery(api, ['nudge_log'], async (c) =>
          unwrapList(await c.from('nudge_log').select('*').gte('date', from)),
        ),
      providesTags: ['Nudge'],
    }),
  }),
});

export const { useGetNudgesSinceQuery } = nudgesApi;
