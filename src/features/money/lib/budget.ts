import { addDays, type DateString, daysBetween } from '@/lib/dates';

import { amountOf, type ExpenseLike, monthOffset } from './analytics';

/** Per-category bars: amber from 80 %, red from 100 % (PRD F18). */
export const AMBER_PCT = 80;
export const RED_PCT = 100;

export type BudgetTone = 'ok' | 'amber' | 'red';
export const budgetTone = (spent: number, budget: number): BudgetTone => {
  if (budget <= 0) return spent > 0 ? 'red' : 'ok';
  const pct = (spent / budget) * 100;
  return pct >= RED_PCT ? 'red' : pct >= AMBER_PCT ? 'amber' : 'ok';
};

const live = (e: ExpenseLike) => !e.deleted_at;
const debits = (rows: readonly ExpenseLike[]) =>
  rows.filter((e) => live(e) && e.direction === 'debit');
const sum = (rows: readonly ExpenseLike[]) => rows.reduce((s, e) => s + amountOf(e), 0);

export const daysInMonth = (today: DateString) =>
  daysBetween(monthOffset(today, 0), monthOffset(today, 1));
export const dayOfMonth = (today: DateString) => Number(today.slice(8, 10));

export type MonthView = {
  spent: number;
  budget: number;
  left: number;
  /** Left ÷ days remaining, today included; 0 when over. */
  perDay: number;
  day: number;
  days: number;
  /** 0–1 even-pace position for today. */
  pace: number;
  /** Where spend should be by the end of today at an even pace. */
  paceAmount: number;
  income: number;
  todaySpend: number;
  todayCount: number;
  /** Debits on the same days of last month (1 … today's day). */
  sameDaysLastMonth: number;
};

/** This month's spend vs the overall budget (AC1: debits only; income separate). */
export function monthView(
  rows: readonly ExpenseLike[],
  today: DateString,
  budget: number,
): MonthView {
  const start = monthOffset(today, 0);
  const month = rows.filter((e) => live(e) && e.date >= start && e.date <= today);
  const spent = sum(debits(month));
  const day = dayOfMonth(today);
  const days = daysInMonth(today);
  const left = budget - spent;
  const prevStart = monthOffset(today, -1);
  const prevEnd = addDays(prevStart, Math.min(day, daysInMonth(prevStart)) - 1);
  const todays = debits(rows).filter((e) => e.date === today);
  return {
    spent,
    budget,
    left,
    perDay: left > 0 ? Math.floor(left / (days - day + 1)) : 0,
    day,
    days,
    pace: day / days,
    paceAmount: Math.round((budget * day) / days),
    income: sum(month.filter((e) => e.direction === 'credit')),
    todaySpend: sum(todays),
    todayCount: todays.length,
    sameDaysLastMonth: sum(debits(rows).filter((e) => e.date >= prevStart && e.date <= prevEnd)),
  };
}

/** "12% lower than October" against the same days of last month; null without last month's spend. */
export function vsLastMonthPct(view: MonthView): number | null {
  if (!(view.sameDaysLastMonth > 0)) return null;
  return Math.round(((view.spent - view.sameDaysLastMonth) / view.sameDaysLastMonth) * 100);
}

export type CategoryLike = {
  id: string;
  name: string;
  icon: string;
  monthly_budget_inr: number | null;
  sort: number;
  deleted_at?: string | null;
};

export type CategoryBudget<C extends CategoryLike = CategoryLike> = {
  category: C;
  spent: number;
  budget: number;
  pct: number;
  tone: BudgetTone;
  left: number;
};

/** Spend this month per budgeted category (categories without a budget, like Income, are left out). */
export function categoryBudgets<C extends CategoryLike>(
  rows: readonly ExpenseLike[],
  categories: readonly C[],
  today: DateString,
  fallbackId: string | null,
): CategoryBudget<C>[] {
  const start = monthOffset(today, 0);
  const month = debits(rows).filter((e) => e.date >= start && e.date <= today);
  return [...categories]
    .filter((c) => !c.deleted_at && c.monthly_budget_inr !== null)
    .sort((a, b) => a.sort - b.sort)
    .map((c) => {
      const spent = sum(month.filter((e) => (e.category_id ?? fallbackId) === c.id));
      const budget = c.monthly_budget_inr ?? 0;
      return {
        category: c,
        spent,
        budget,
        pct: budget > 0 ? Math.round((spent / budget) * 100) : 0,
        tone: budgetTone(spent, budget),
        left: budget - spent,
      };
    });
}

/** Overall budget minus the categories' budgets. */
export const unallocated = (overall: number, cats: readonly CategoryBudget[]) =>
  overall - cats.reduce((s, c) => s + c.budget, 0);

/** "Transport over by ₹99 · Bills at 90%": over-budget first, then amber ones. */
export function budgetAlerts(cats: readonly CategoryBudget[]): CategoryBudget[] {
  return [...cats]
    .filter((c) => c.tone !== 'ok')
    .sort((a, b) => (a.tone === b.tone ? b.pct - a.pct : a.tone === 'red' ? -1 : 1));
}

/** Debits per day for the last `n` days ending today. */
export function dailySpend(
  rows: readonly ExpenseLike[],
  today: DateString,
  n = 14,
): { date: DateString; total: number }[] {
  const by = new Map<string, number>();
  for (const e of debits(rows)) by.set(e.date, (by.get(e.date) ?? 0) + amountOf(e));
  return Array.from({ length: n }, (_, i) => {
    const date = addDays(today, i - n + 1);
    return { date, total: by.get(date) ?? 0 };
  });
}
