import { baseApi } from '@/store/baseApi';
import { supabaseQuery, unwrapList } from '@/store/supabaseQuery';
import type { Tables } from '@/types/supabase';

export type Nutrition = {
  food: Pick<Tables<'food_log'>, 'client_id' | 'date' | 'kcal' | 'protein_g' | 'deleted_at'>[];
  coffee: Pick<Tables<'coffee_log'>, 'client_id' | 'date' | 'deleted_at'>[];
};

export const progressApi = baseApi.injectEndpoints({
  endpoints: (b) => ({
    /** kcal and protein per day from a date on (Progress → Food). */
    getNutritionSince: b.query<Nutrition, string>({
      queryFn: (from, api) =>
        supabaseQuery(api, ['food_log', 'coffee_log'], async (c) => ({
          food: unwrapList(
            await c
              .from('food_log')
              .select('client_id, date, kcal, protein_g, deleted_at')
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

export const { useGetNutritionSinceQuery } = progressApi;
