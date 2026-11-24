import { baseApi } from '@/store/baseApi';
import { supabaseQuery, unwrapList } from '@/store/supabaseQuery';
import type { Tables } from '@/types/supabase';

export type ExpenseRow = Tables<'expense'>;
export type ExpenseCategoryRow = Tables<'expense_category'>;

export const moneyApi = baseApi.injectEndpoints({
  endpoints: (b) => ({
    /** Categories with budgets (seeded per PRD F18), in their order. */
    getExpenseCategories: b.query<ExpenseCategoryRow[], void>({
      queryFn: (_arg, api) =>
        supabaseQuery(api, ['expense_category'], async (c) =>
          unwrapList(
            await c.from('expense_category').select('*').is('deleted_at', null).order('sort'),
          ),
        ),
      providesTags: ['Expense'],
    }),
    /**
     * Every expense (single user; analytics "All" and search are client-side,
     * as in the reference). Deleted rows kept so Undo can revive them.
     */
    getExpenses: b.query<ExpenseRow[], void>({
      queryFn: (_arg, api) =>
        supabaseQuery(api, ['expense'], async (c) =>
          unwrapList(await c.from('expense').select('*').order('date', { ascending: false })),
        ),
      providesTags: ['Expense'],
    }),
  }),
});

export const { useGetExpenseCategoriesQuery, useGetExpensesQuery } = moneyApi;
