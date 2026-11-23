import { baseApi } from '@/store/baseApi';
import { supabaseQuery, unwrapList } from '@/store/supabaseQuery';
import type { Tables } from '@/types/supabase';

export type WeightLogRow = Tables<'weight_log'>;
export type Intake = {
  food: Pick<Tables<'food_log'>, 'client_id' | 'date' | 'kcal' | 'deleted_at'>[];
  coffee: Pick<Tables<'coffee_log'>, 'client_id' | 'date' | 'deleted_at'>[];
};

export const bodyApi = baseApi.injectEndpoints({
  endpoints: (b) => ({
    /** Every weigh-in; deleted rows kept (one per day, client_id reused). */
    getWeights: b.query<WeightLogRow[], void>({
      queryFn: (_arg, api) =>
        supabaseQuery(api, ['weight_log'], async (c) =>
          unwrapList(await c.from('weight_log').select('*').order('date')),
        ),
      providesTags: ['Weight'],
    }),

    /** kcal logged per day from a date on (food + coffee), for the intake projection and measured TDEE. */
    getIntakeSince: b.query<Intake, string>({
      queryFn: (from, api) =>
        supabaseQuery(api, ['food_log', 'coffee_log'], async (c) => ({
          food: unwrapList(
            await c
              .from('food_log')
              .select('client_id, date, kcal, deleted_at')
              .gte('date', from)
              .is('deleted_at', null),
          ),
          coffee: unwrapList(
            await c
              .from('coffee_log')
              .select('client_id, date, deleted_at')
              .gte('date', from)
              .is('deleted_at', null),
          ),
        })),
      providesTags: ['Food'],
    }),
  }),
});

export const { useGetWeightsQuery, useGetIntakeSinceQuery } = bodyApi;
