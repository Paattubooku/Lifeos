import type { ExpenseLike } from '../lib/analytics';
import {
  budgetAlerts,
  budgetTone,
  type CategoryLike,
  categoryBudgets,
  dailySpend,
  daysInMonth,
  monthView,
  unallocated,
  vsLastMonthPct,
} from '../lib/budget';
import {
  byDay,
  filterExpenses,
  hasFilters,
  keypadInput,
  methodLabel,
  newestFirst,
  NO_FILTERS,
  parseAmount,
  planExpense,
} from '../lib/expense';

const TODAY = '2026-11-23';
const e = (
  date: string,
  amount: number,
  over: Partial<ExpenseLike & { note: string | null; created_at: string }> = {},
) => ({
  date,
  amount_inr: amount,
  direction: 'debit',
  category_id: 'food',
  merchant: 'Shop',
  note: null as string | null,
  ...over,
});
const CATS: CategoryLike[] = [
  {
    id: 'food',
    name: 'Food & groceries',
    icon: 'shopping-basket',
    monthly_budget_inr: 6000,
    sort: 0,
  },
  { id: 'bills', name: 'Bills', icon: 'receipt', monthly_budget_inr: 1500, sort: 1 },
  { id: 'transport', name: 'Transport', icon: 'bus', monthly_budget_inr: 800, sort: 2 },
  { id: 'other', name: 'Other', icon: 'ellipsis', monthly_budget_inr: 1000, sort: 5 },
  { id: 'income', name: 'Income', icon: 'wallet', monthly_budget_inr: null, sort: 6 },
];

describe('month view (AC1: debits only, income separate)', () => {
  const rows = [
    e(TODAY, 220),
    e(TODAY, 80, { category_id: 'transport' }),
    e('2026-11-02', 1000, { category_id: null }),
    e('2026-11-01', 50000, { direction: 'credit', category_id: 'income' }),
    e('2026-11-24', 999),
    e(TODAY, 500, { deleted_at: 'x' }),
    e('2026-10-23', 1300),
    e('2026-10-24', 9999),
  ];
  it('spent, left, per day, pace, income, today, same days last month', () => {
    const v = monthView(rows, TODAY, 18000);
    expect(v).toEqual({
      spent: 1300,
      budget: 18000,
      left: 16700,
      perDay: 2087,
      day: 23,
      days: 30,
      pace: 23 / 30,
      paceAmount: 13800,
      income: 50000,
      todaySpend: 300,
      todayCount: 2,
      sameDaysLastMonth: 1300,
    });
    expect(vsLastMonthPct(v)).toBe(0);
    expect(vsLastMonthPct({ ...v, sameDaysLastMonth: 0 })).toBeNull();
    expect(monthView(rows, TODAY, 1000)).toMatchObject({ left: -300, perDay: 0 });
    // 31 March → last month (Feb) only has 28 days
    expect(monthView([e('2026-02-28', 10)], '2026-03-31', 0).sameDaysLastMonth).toBe(10);
    expect(daysInMonth('2026-02-10')).toBe(28);
  });

  it('category bars: amber ≥ 80 %, red ≥ 100 %; uncategorised counts as Other', () => {
    const cats = categoryBudgets(
      [
        ...rows,
        e(TODAY, 1200, { category_id: 'bills' }),
        e(TODAY, 750, { category_id: 'transport' }),
      ],
      CATS,
      TODAY,
      'other',
    );
    expect(cats.map((c) => [c.category.id, c.spent, c.pct, c.tone, c.left])).toEqual([
      ['food', 220, 4, 'ok', 5780],
      ['bills', 1200, 80, 'amber', 300],
      ['transport', 830, 104, 'red', -30],
      ['other', 1000, 100, 'red', 0],
    ]);
    expect(unallocated(18000, cats)).toBe(8700);
    expect(budgetAlerts(cats).map((c) => c.category.id)).toEqual(['transport', 'other', 'bills']);
    expect(budgetTone(0, 0)).toBe('ok');
    expect(budgetTone(1, 0)).toBe('red');
    expect(budgetTone(799, 1000)).toBe('ok');
  });

  it('14-day bars', () => {
    const d = dailySpend(rows, TODAY);
    expect(d).toHaveLength(14);
    expect(d.at(-1)).toEqual({ date: TODAY, total: 300 });
    expect(d[0]!.date).toBe('2026-11-10');
  });
});

describe('add expense and filters', () => {
  it('keypad: one dot, two decimals, cap', () => {
    let t = '';
    for (const k of ['0', '2', '4', '0', '.', '5', '0', '9', '.']) t = keypadInput(t, k);
    expect(t).toBe('240.50');
    expect(keypadInput('', '.')).toBe('0.');
    expect(keypadInput('240', 'back')).toBe('24');
    expect(keypadInput('999999', '9')).toBe('999999');
    expect(keypadInput('12', 'x')).toBe('12');
    expect(parseAmount('240.50')).toBe(240.5);
    expect(parseAmount('0')).toBeNull();
    expect(parseAmount('')).toBeNull();
  });

  it('row for a manual expense', () => {
    expect(
      planExpense({
        amount: 240,
        date: TODAY,
        direction: 'debit',
        categoryId: 'food',
        method: 'upi',
        merchant: ' Murugan Stores ',
        note: '',
        recurring: false,
      }),
    ).toEqual({
      date: TODAY,
      amount_inr: 240,
      direction: 'debit',
      category_id: 'food',
      payment_method: 'upi',
      merchant: 'Murugan Stores',
      note: null,
      is_recurring: false,
      source: 'manual',
    });
    expect(methodLabel('upi')).toBe('UPI');
    expect(methodLabel('netbanking')).toBe('Net banking');
    expect(methodLabel('weird')).toBe('Other');
  });

  it('filters (reference useExpenseFilters + note/amount search), sort, day groups', () => {
    const rows = [
      e(TODAY, 220, { merchant: 'Murugan Stores', created_at: '2' }),
      e(TODAY, 80, { merchant: 'Ola auto', category_id: 'transport', created_at: '3' }),
      e('2026-11-22', 1240, { merchant: 'BigBasket', note: 'monthly' }),
      e('2026-11-01', 50000, { merchant: 'Salary', direction: 'credit' }),
      e('2026-11-01', 5, { deleted_at: 'x' }),
    ];
    expect(filterExpenses(rows, NO_FILTERS)).toHaveLength(4);
    expect(filterExpenses(rows, { ...NO_FILTERS, type: 'credit' }).map((r) => r.merchant)).toEqual([
      'Salary',
    ]);
    expect(filterExpenses(rows, { ...NO_FILTERS, category: 'transport' })).toHaveLength(1);
    expect(filterExpenses(rows, { ...NO_FILTERS, search: 'ola' })).toHaveLength(1);
    expect(filterExpenses(rows, { ...NO_FILTERS, search: 'MONTH' })).toHaveLength(1);
    expect(filterExpenses(rows, { ...NO_FILTERS, search: '₹1,240' })).toHaveLength(1);
    expect(
      filterExpenses([{ ...rows[0]!, merchant: null }], { ...NO_FILTERS, search: 'x' }),
    ).toHaveLength(0);
    expect(hasFilters(NO_FILTERS)).toBe(false);
    expect(hasFilters({ ...NO_FILTERS, search: ' a' })).toBe(true);
    const sorted = newestFirst(filterExpenses(rows, NO_FILTERS));
    expect(sorted.map((r) => r.merchant)).toEqual([
      'Ola auto',
      'Murugan Stores',
      'BigBasket',
      'Salary',
    ]);
    expect(byDay(sorted).map((g) => [g.date, g.spent, g.rows.length])).toEqual([
      [TODAY, 300, 2],
      ['2026-11-22', 1240, 1],
      ['2026-11-01', 0, 1],
    ]);
  });
});
