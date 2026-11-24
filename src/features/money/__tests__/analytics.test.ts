import {
  analytics,
  type AnalyticsRange,
  type ExpenseLike,
  monthComparison,
  monthOffset,
  RANGES,
  rangeStart,
  weekdayAverages,
} from '../lib/analytics';
import input from './fixtures/reference-input.json';
import expected from './fixtures/reference-output.json';

/** The reference hook's output for this fixture, produced by running its own code (2026-11-24). */
type Ref = (typeof expected)['7d'];
const TODAY = '2026-11-24';
const ORDER = ['food', 'bills', 'cash', 'card', 'shopping', 'transfer', 'income', 'other'];
const rows: ExpenseLike[] = input.map((e) => ({
  date: e.txn_date,
  amount_inr: e.amount,
  direction: e.type,
  category_id: e.category,
  merchant: e.payee,
}));

describe('F18 AC2: analytics match the reference hook on the same fixture', () => {
  it.each(RANGES)('%s', (range: AnalyticsRange) => {
    const ref = expected[range] as Ref;
    const a = analytics(rows, range, TODAY, { order: ORDER, fallback: 'other' });
    expect(a.totalDebit).toBe(ref.totalDebit);
    expect(a.totalCredit).toBe(ref.totalCredit);
    expect(a.net).toBe(ref.net);
    expect(a.avgTransaction).toBeCloseTo(ref.avgTransaction, 9);
    expect(a.txnCount).toBe(ref.txnCount);
    expect(
      a.categories.map((c) => [c.category, c.total, c.count, Math.round(c.percentage * 100) / 100]),
    ).toEqual(ref.categories);
    expect(a.topPayees.map((p) => [p.payee, p.total, p.count, p.lastDate])).toEqual(ref.topPayees);
    expect(a.weekdayPattern.map((w) => [w.label, w.total, w.count])).toEqual(ref.weekday);
    expect(a.dailyTrend).toHaveLength(ref.trendLen);
    expect(a.dailyTrend[0]).toEqual(ref.trendFirst);
    expect(a.dailyTrend.at(-1)).toEqual(ref.trendLast);
    expect(a.dailyTrend.filter((d) => d.debit || d.credit)).toEqual(ref.trendNonZero);
    expect(a.monthComparison.currentMonthTotal).toBe(ref.month.currentMonthTotal);
    expect(a.monthComparison.previousMonthTotal).toBe(ref.month.previousMonthTotal);
    expect(a.monthComparison.changePct).toBeCloseTo(ref.month.changePct!, 9);
  });
});

describe('F18 AC1 and edge cases', () => {
  it('spend totals exclude credits; income separate; deleted and future rows ignored', () => {
    const a = analytics(
      [
        ...rows,
        {
          date: TODAY,
          amount_inr: '999',
          direction: 'debit',
          category_id: null,
          merchant: ' ',
          deleted_at: 'x',
        },
        {
          date: '2026-11-25',
          amount_inr: 5,
          direction: 'debit',
          category_id: 'food',
          merchant: 'x',
        },
      ],
      '7d',
      TODAY,
      { order: ORDER, fallback: 'other' },
    );
    expect(a.totalDebit).toBe(3442);
    expect(a.totalCredit).toBe(2000);
  });

  it('uncategorised → fallback; blank payee → Unknown; empty data', () => {
    const a = analytics(
      [{ date: TODAY, amount_inr: '10.5', direction: 'debit', category_id: null, merchant: '  ' }],
      'all',
      TODAY,
      { order: ORDER, fallback: 'other' },
    );
    expect(a.categories).toEqual([{ category: 'other', total: 10.5, count: 1, percentage: 100 }]);
    expect(a.topPayees[0]!.payee).toBe('Unknown');
    const none = analytics([], 'month', TODAY, { order: ORDER, fallback: 'other' });
    expect(none).toMatchObject({ totalDebit: 0, avgTransaction: 0, categories: [] });
    expect(none.monthComparison.changePct).toBeNull();
    expect(monthComparison([], TODAY).changePct).toBeNull();
  });

  it('month helpers across a year boundary', () => {
    expect(monthOffset('2026-01-15', -1)).toBe('2025-12-01');
    expect(monthOffset('2026-12-15', 1)).toBe('2027-01-01');
    expect(rangeStart('month', TODAY)).toBe('2026-11-01');
    expect(rangeStart('all', TODAY)).toBeNull();
  });

  it('weekday averages Monday first', () => {
    const a = analytics(rows, '7d', TODAY, { order: ORDER, fallback: 'other' });
    const w = weekdayAverages(a.weekdayPattern, rangeStart('7d', TODAY)!, TODAY);
    expect(w.map((x) => x.label)).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
    expect(w[1]).toEqual({ label: 'Tue', total: 340, days: 1, avg: 340 });
    expect(w.reduce((s, x) => s + x.days, 0)).toBe(7);
  });
});
