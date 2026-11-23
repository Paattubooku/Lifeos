import { baseApi } from '@/store/baseApi';
import { supabaseQuery, unwrapList } from '@/store/supabaseQuery';
import type { Tables } from '@/types/supabase';

export type DayLogRef = Pick<
  Tables<'day_log'>,
  'client_id' | 'date' | 'template_id' | 'deleted_at'
>;

export const routineApi = baseApi.injectEndpoints({
  endpoints: (b) => ({
    /** Day logs from `from` on — which templates recent days used (delete vs archive rule). */
    getDayLogsSince: b.query<DayLogRef[], string>({
      queryFn: (from, api) =>
        supabaseQuery(api, ['day_log'], async (c) =>
          unwrapList(
            await c
              .from('day_log')
              .select('client_id, date, template_id, deleted_at')
              .gte('date', from)
              .is('deleted_at', null),
          ),
        ),
      providesTags: ['DayLog'],
    }),
  }),
});

export const { useGetDayLogsSinceQuery } = routineApi;
