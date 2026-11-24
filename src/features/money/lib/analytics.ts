/**
 * Expense analytics: a port of My-Tracker `useExpenseAnalytics` (PRD F18 AC2)
 * as a pure function. Same maths; dates are IST logical days passed in as
 * `today` instead of the reference's UTC `new Date()`.
 */
import { addDays, type DateString, daysBetween, isoWeekday } from '@/lib/dates';

export type ExpenseLike = {
  date: string;
  amount_inr: number | string;
  direction: string;
  category_id: string | null;
  merchant: string | null;
  deleted_at?: string | null;
};

export type AnalyticsRange = '7d' | '30d' | '90d' | 'month' | 'all';
export const RANGES: readonly AnalyticsRange[] = ['7d', '30d', '90d', 'month', 'all'];
export const RANGE_LABELS: Record<AnalyticsRange, string> = {
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
  month: 'This month',
  all: 'All time',
};
/** The daily bars never show more than 90 days, even for "All". */
export const DAILY_TREND_CAP_DAYS = 90;
const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export type CategorySlice = { category: string; total: number; count: number; percentage: number };
export type PayeeStat = { payee: string; total: number; count: number; lastDate: string };
export type WeekdayStat = { weekday: number; label: string; total: number; count: number };
export type DailyPoint = { date: string; debit: number; credit: number };
export type MonthComparison = {
  currentMonthTotal: number;
  previousMonthTotal: number;
  changePct: number | null;
};

export type Analytics = {
  totalDebit: number;
  totalCredit: number;
  net: number;
  avgTransaction: number;
  txnCount: number;
  categories: CategorySlice[];
  dailyTrend: DailyPoint[];
  topPayees: PayeeStat[];
  weekdayPattern: WeekdayStat[];
  monthComparison: MonthComparison;
};

export const amountOf = (e: Pick<ExpenseLike, 'amount_inr'>) => Number(e.amount_inr) || 0;
export const monthStart = (d: DateString): DateString => `${d.slice(0, 7)}-01`;

export function rangeStart(range: AnalyticsRange, today: DateString): DateString | null {
  switch (range) {
    case '7d':
      return addDays(today, -6);
    case '30d':
      return addDays(today, -29);
    case '90d':
      return addDays(today, -89);
    case 'month':
      return monthStart(today);
    case 'all':
      return null;
  }
}

/** First day of the month `offset` months from today's. */
export function monthOffset(today: DateString, offset: number): DateString {
  const y = Number(today.slice(0, 4));
  const m = Number(today.slice(5, 7)) - 1 + offset;
  const yy = y + Math.floor(m / 12);
  const mm = ((m % 12) + 12) % 12;
  return `${yy}-${String(mm + 1).padStart(2, '0')}-01`;
}

/** Debits this calendar month vs all of last month (reference "12% higher than last month"). */
export function monthComparison(all: readonly ExpenseLike[], today: DateString): MonthComparison {
  const cur = monthOffset(today, 0);
  const next = monthOffset(today, 1);
  const prev = monthOffset(today, -1);
  let currentMonthTotal = 0;
  let previousMonthTotal = 0;
  for (const e of all) {
    if (e.direction !== 'debit') continue;
    if (e.date >= cur && e.date < next) currentMonthTotal += amountOf(e);
    else if (e.date >= prev && e.date < cur) previousMonthTotal += amountOf(e);
  }
  return {
    currentMonthTotal,
    previousMonthTotal,
    changePct:
      previousMonthTotal > 0
        ? ((currentMonthTotal - previousMonthTotal) / previousMonthTotal) * 100
        : null,
  };
}

/**
 * Everything the Analytics tab shows for a range. `order` is the category
 * order (the reference's ALL_CATEGORIES); uncategorised debits count as
 * `fallback`. Credits only add to totalCredit.
 */
export function analytics(
  input: readonly ExpenseLike[],
  range: AnalyticsRange,
  today: DateString,
  opts: { order: readonly string[]; fallback: string },
): Analytics {
  const all = input.filter((e) => !e.deleted_at);
  const start = rangeStart(range, today);
  const inRange = all.filter((e) => (start ? e.date >= start : true) && e.date <= today);

  let totalDebit = 0;
  let totalCredit = 0;
  let debitCount = 0;
  const cats = new Map<string, { total: number; count: number }>();
  const payees = new Map<string, { total: number; count: number; lastDate: string }>();
  const weekdays = new Map<number, { total: number; count: number }>();

  for (const e of inRange) {
    const amount = amountOf(e);
    if (e.direction === 'credit') {
      totalCredit += amount;
      continue;
    }
    totalDebit += amount;
    debitCount += 1;

    const cat = e.category_id || opts.fallback;
    const c = cats.get(cat) ?? { total: 0, count: 0 };
    cats.set(cat, { total: c.total + amount, count: c.count + 1 });

    const name = e.merchant?.trim() || 'Unknown';
    const p = payees.get(name) ?? { total: 0, count: 0, lastDate: e.date };
    payees.set(name, {
      total: p.total + amount,
      count: p.count + 1,
      lastDate: e.date > p.lastDate ? e.date : p.lastDate,
    });

    const wd = isoWeekday(e.date) % 7; // 0 = Sunday, as in the reference
    const w = weekdays.get(wd) ?? { total: 0, count: 0 };
    weekdays.set(wd, { total: w.total + amount, count: w.count + 1 });
  }

  const categories = opts.order
    .filter((c) => cats.has(c))
    .map((c) => ({
      category: c,
      total: cats.get(c)!.total,
      count: cats.get(c)!.count,
      percentage: totalDebit > 0 ? (cats.get(c)!.total / totalDebit) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total);

  const topPayees = [...payees.entries()]
    .map(([payee, s]) => ({ payee, ...s }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);

  const weekdayPattern = WEEKDAY_LABELS.map((label, weekday) => ({
    weekday,
    label,
    total: weekdays.get(weekday)?.total ?? 0,
    count: weekdays.get(weekday)?.count ?? 0,
  }));

  const trendDays = start
    ? Math.min(DAILY_TREND_CAP_DAYS, daysBetween(start, today) + 1)
    : DAILY_TREND_CAP_DAYS;
  const trendStart = addDays(today, -(trendDays - 1));
  const daily = new Map<string, { debit: number; credit: number }>();
  for (const e of all) {
    if (e.date < trendStart || e.date > today) continue;
    const d = daily.get(e.date) ?? { debit: 0, credit: 0 };
    if (e.direction === 'debit') d.debit += amountOf(e);
    else d.credit += amountOf(e);
    daily.set(e.date, d);
  }
  const dailyTrend = Array.from({ length: trendDays }, (_, i) => {
    const date = addDays(trendStart, i);
    return { date, debit: daily.get(date)?.debit ?? 0, credit: daily.get(date)?.credit ?? 0 };
  });

  return {
    totalDebit,
    totalCredit,
    net: totalCredit - totalDebit,
    avgTransaction: debitCount > 0 ? totalDebit / debitCount : 0,
    txnCount: debitCount,
    categories,
    dailyTrend,
    topPayees,
    weekdayPattern,
    monthComparison: monthComparison(all, today),
  };
}

/** Weekday stats Monday first (design), with the average per calendar day of that weekday in range. */
export function weekdayAverages(
  pattern: readonly WeekdayStat[],
  start: DateString,
  today: DateString,
): { label: string; total: number; days: number; avg: number }[] {
  const days = new Map<number, number>();
  for (let d = start; d <= today; d = addDays(d, 1)) {
    const wd = isoWeekday(d) % 7;
    days.set(wd, (days.get(wd) ?? 0) + 1);
  }
  return [1, 2, 3, 4, 5, 6, 0].map((wd) => {
    const p = pattern[wd]!;
    const n = days.get(wd) ?? 0;
    return { label: p.label, total: p.total, days: n, avg: n > 0 ? Math.round(p.total / n) : 0 };
  });
}
