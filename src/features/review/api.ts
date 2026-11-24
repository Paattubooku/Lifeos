import { baseApi } from '@/store/baseApi';
import { supabaseQuery, unwrapList } from '@/store/supabaseQuery';
import type { Tables } from '@/types/supabase';

export type WeeklyReviewRow = Tables<'weekly_review'>;
export type RollupViewRow = Tables<'v_weekly_rollup'>;

export const reviewApi = baseApi.injectEndpoints({
  endpoints: (b) => ({
    /** v_weekly_rollup from a week on (this week + the one before, for the change). */
    getRollup: b.query<RollupViewRow[], string>({
      queryFn: (from, api) =>
        supabaseQuery(
          api,
          ['day_log', 'session_log', 'food_log', 'weight_log', 'sleep_log', 'expense'],
          async (c) =>
            unwrapList(await c.from('v_weekly_rollup').select('*').gte('week_start', from)),
        ),
      providesTags: ['Review', 'DayLog', 'Expense'],
    }),
    /** Every weekly review, newest first; deleted rows kept (unique per week). */
    getReviews: b.query<WeeklyReviewRow[], void>({
      queryFn: (_arg, api) =>
        supabaseQuery(api, ['weekly_review'], async (c) =>
          unwrapList(
            await c.from('weekly_review').select('*').order('week_start', { ascending: false }),
          ),
        ),
      providesTags: ['Review'],
    }),
  }),
});

export const { useGetRollupQuery, useGetReviewsQuery } = reviewApi;
