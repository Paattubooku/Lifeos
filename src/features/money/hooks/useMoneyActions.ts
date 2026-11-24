import { applyChanges } from '@/features/routine/slice';
import { formatInr } from '@/lib/format';
import { useAppDispatch } from '@/store';
import { haptics, useSnackbar } from '@/ui';

import type { ExpenseRow } from '../api';
import { type NewExpense, planExpense } from '../lib/expense';

/** Expense and budget writes: optimistic, through the sync queue, Undo instead of confirms. */
export function useMoneyActions() {
  const dispatch = useAppDispatch();
  const showSnackbar = useSnackbar();
  const apply = (c: Parameters<typeof applyChanges>[0]) => dispatch(applyChanges(c));

  const add = (e: NewExpense, categoryName: string | null) => {
    haptics.success();
    void apply([{ op: 'upsert', table: 'expense', row: planExpense(e) }]);
    showSnackbar({
      message: `${formatInr(e.amount, e.amount % 1 ? 2 : 0)} ${e.direction === 'credit' ? 'received' : 'saved'}${categoryName ? ` · ${categoryName}` : ''}`,
    });
  };

  const remove = (e: ExpenseRow) => {
    haptics.tap();
    void apply([{ op: 'delete', table: 'expense', clientId: e.client_id }]);
    showSnackbar({
      message: `${e.merchant ?? 'Expense'} deleted`,
      actionLabel: 'Undo',
      onAction: () =>
        void apply([
          { op: 'upsert', table: 'expense', clientId: e.client_id, row: { deleted_at: null } },
        ]),
    });
  };

  /** Save edited category budgets/icons and the overall budget in one go. */
  const saveBudgets = (
    categories: { clientId: string; icon: string; budget: number | null }[],
    overall: { clientId: string; budget: number } | null,
  ) => {
    void apply([
      ...categories.map((c) => ({
        op: 'upsert' as const,
        table: 'expense_category' as const,
        clientId: c.clientId,
        row: { icon: c.icon, monthly_budget_inr: c.budget },
      })),
      ...(overall
        ? [
            {
              op: 'upsert' as const,
              table: 'profile' as const,
              clientId: overall.clientId,
              row: { monthly_budget_inr: overall.budget },
            },
          ]
        : []),
    ]);
    showSnackbar({ message: 'Budgets saved' });
  };

  return { add, remove, saveBudgets };
}
