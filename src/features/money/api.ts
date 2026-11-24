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

export type ApiTokenRow = Pick<
  Tables<'api_token'>,
  | 'id'
  | 'client_id'
  | 'name'
  | 'last4'
  | 'created_at'
  | 'last_used_at'
  | 'revoked_at'
  | 'deleted_at'
>;
export type SkippedRow = Tables<'expense_skipped'>;

export const integrationsApi = baseApi.injectEndpoints({
  endpoints: (b) => ({
    /** Token names and last 4 only; the hash never needs to reach the app. */
    getApiTokens: b.query<ApiTokenRow[], void>({
      queryFn: (_arg, api) =>
        supabaseQuery(api, ['api_token'], async (c) =>
          unwrapList(
            await c
              .from('api_token')
              .select(
                'id, client_id, name, last4, created_at, last_used_at, revoked_at, deleted_at',
              )
              .is('deleted_at', null)
              .order('created_at', { ascending: false }),
          ),
        ),
      providesTags: ['Expense'],
    }),
    /** Messages still waiting in the inbox (a parse error leaves them there). */
    getInbox: b.query<
      Pick<Tables<'expense_inbox'>, 'id' | 'raw_sms' | 'received_at' | 'attempts' | 'last_error'>[],
      void
    >({
      queryFn: (_arg, api) =>
        supabaseQuery(api, ['expense_inbox'], async (c) =>
          unwrapList(
            await c
              .from('expense_inbox')
              .select('id, raw_sms, received_at, attempts, last_error')
              .is('deleted_at', null)
              .order('received_at'),
          ),
        ),
      providesTags: ['Expense'],
    }),
    /** The latest skipped / unmatched messages. */
    getSkipped: b.query<SkippedRow[], void>({
      queryFn: (_arg, api) =>
        supabaseQuery(api, ['expense_skipped'], async (c) =>
          unwrapList(
            await c
              .from('expense_skipped')
              .select('*')
              .is('deleted_at', null)
              .order('received_at', { ascending: false })
              .limit(30),
          ),
        ),
      providesTags: ['Expense'],
    }),
  }),
});

export const { useGetApiTokensQuery, useGetInboxQuery, useGetSkippedQuery } = integrationsApi;
