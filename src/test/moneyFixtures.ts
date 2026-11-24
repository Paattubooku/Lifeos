import { moneyApi } from '@/features/money/api';
import { addDays } from '@/lib/dates';
import type { Tables } from '@/types/supabase';

import { base } from './profileFixtures';
import { todayStore } from './todayFixtures';

export const CATEGORIES: Tables<'expense_category'>[] = [
  ['food', 'Food & groceries', 'shopping-basket', 6000],
  ['bills', 'Bills', 'receipt', 1500],
  ['transport', 'Transport', 'bus', 800],
  ['health', 'Health', 'heart-pulse', 2000],
  ['shopping', 'Shopping', 'shopping-bag', 1500],
  ['other', 'Other', 'ellipsis', 1000],
  ['income', 'Income', 'wallet', null],
].map(([id, name, icon, budget], sort) => ({
  ...base,
  id: id as string,
  client_id: `${id as string}-c`,
  name: name as string,
  icon: icon as string,
  monthly_budget_inr: budget as number | null,
  sort,
}));

/** [daysAgo, amount, category, merchant, extra]. */
export type ExpenseSpec = [
  number,
  number,
  string | null,
  string | null,
  Partial<Tables<'expense'>>?,
];

/** The Today fixture plus categories and expenses (offline; writes stay queued). */
export async function moneyStore(specs: ExpenseSpec[] = []) {
  const t = await todayStore();
  const rows: Tables<'expense'>[] = specs.map(([ago, amount, cat, merchant, extra], i) => ({
    ...base,
    id: `ex${i}`,
    client_id: `ex${i}`,
    date: addDays(t.today, -ago),
    amount_inr: amount,
    category_id: cat,
    merchant,
    note: null,
    direction: cat === 'income' ? 'credit' : 'debit',
    payment_method: 'upi',
    is_recurring: false,
    source: 'manual',
    txn_ref: null,
    parse_rule: null,
    raw_sms: null,
    created_at: new Date(
      Date.parse(`${addDays(t.today, -ago)}T06:00:00Z`) + i * 60_000,
    ).toISOString(),
    ...extra,
  }));
  await t.store.dispatch(
    moneyApi.util.upsertQueryData('getExpenseCategories', undefined, CATEGORIES),
  );
  await t.store.dispatch(moneyApi.util.upsertQueryData('getExpenses', undefined, rows));
  return { ...t, rows };
}
