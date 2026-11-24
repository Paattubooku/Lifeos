import { baseApi } from '@/store/baseApi';
import { supabaseQuery, unwrapList } from '@/store/supabaseQuery';
import type { Tables } from '@/types/supabase';

export type TaskDbRow = Tables<'task'>;

export const tasksApi = baseApi.injectEndpoints({
  endpoints: (b) => ({
    /** Open tasks plus those done since `from` (ISO time, completed list). */
    getTasks: b.query<TaskDbRow[], string>({
      queryFn: (from, api) =>
        supabaseQuery(api, ['task'], async (c) =>
          unwrapList(
            await c
              .from('task')
              .select('*')
              .is('deleted_at', null)
              .or(`status.eq.open,done_at.gte.${from}`),
          ),
        ),
      providesTags: ['Task'],
    }),
  }),
});

export const { useGetTasksQuery } = tasksApi;
