import { baseApi } from '@/store/baseApi';
import { supabaseQuery, unwrapList } from '@/store/supabaseQuery';
import type { Tables } from '@/types/supabase';

export type WaterHistoryRow = Pick<
  Tables<'water_log'>,
  'client_id' | 'date' | 'amount_ml' | 'deleted_at'
>;

export const waterApi = baseApi.injectEndpoints({
  endpoints: (b) => ({
    /** Water entries from a date on (streaks, 7-day bars). */
    getWaterSince: b.query<WaterHistoryRow[], string>({
      queryFn: (from, api) =>
        supabaseQuery(api, ['water_log'], async (c) =>
          unwrapList(
            await c
              .from('water_log')
              .select('client_id, date, amount_ml, deleted_at')
              .gte('date', from)
              .is('deleted_at', null),
          ),
        ),
      providesTags: ['Water'],
    }),
  }),
});

export const { useGetWaterSinceQuery } = waterApi;
