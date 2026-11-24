import { useMemo } from 'react';

import { useLocalWrites, useProfile } from '@/features/profile/hooks/useProfileData';
import { live, mergeKeepingDeleted } from '@/features/today/lib/merge';
import { logicalDate } from '@/lib/dates';

import {
  type ExpenseCategoryRow,
  type ExpenseRow,
  useGetExpenseCategoriesQuery,
  useGetExpensesQuery,
} from '../api';
import { newestFirst } from '../lib/expense';

export const DEFAULT_MONTHLY_BUDGET = 18000;

/** Expenses (newest first), categories and the overall budget with local writes applied. */
export function useMoney(now: number) {
  const today = logicalDate(now);
  const { profile } = useProfile();
  const eq = useGetExpensesQuery();
  const cq = useGetExpenseCategoriesQuery();
  const expenseWrites = useLocalWrites('expense');
  const categoryWrites = useLocalWrites('expense_category');

  const all = useMemo(
    () => mergeKeepingDeleted<ExpenseRow>(eq.data ?? [], expenseWrites),
    [eq.data, expenseWrites],
  );
  const expenses = useMemo(() => newestFirst(live(all)), [all]);
  const categories = useMemo(
    () =>
      live(mergeKeepingDeleted<ExpenseCategoryRow>(cq.data ?? [], categoryWrites)).sort(
        (a, b) => a.sort - b.sort,
      ),
    [cq.data, categoryWrites],
  );
  const byId = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const income = categories.find((c) => c.monthly_budget_inr === null && /income/i.test(c.name));
  const other = categories.find((c) => /^other$/i.test(c.name)) ?? null;

  return {
    today,
    profile,
    all,
    expenses,
    categories,
    /** Spending categories (everything except Income). */
    spendCategories: categories.filter((c) => c.id !== income?.id),
    incomeId: income?.id ?? null,
    otherId: other?.id ?? null,
    byId,
    budget: profile?.monthly_budget_inr ?? DEFAULT_MONTHLY_BUDGET,
    isLoading: eq.isLoading || cq.isLoading,
  };
}
