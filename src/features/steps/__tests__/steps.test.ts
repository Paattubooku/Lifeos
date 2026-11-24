import { bucketsToDays } from '../lib/health';
import {
  healthWrites,
  lastDays,
  planSteps,
  type StepsRow,
  stepsHint,
  stepsTone,
  targets,
  weekStats,
} from '../lib/steps';

const T = { min: 6000, stretch: 10000 };
const at = (h: number, m = 0) => h * 60 + m;

describe('targets and hint (AutoFit StepTracker)', () => {
  it('minimum 6,000, stretch +4,000', () => {
    expect(targets(null)).toEqual(T);
    expect(targets(8000)).toEqual({ min: 8000, stretch: 12000 });
    expect(stepsTone(6000, 6000)).toBe('done');
    expect(stepsTone(3000, 6000)).toBe('some');
    expect(stepsTone(2999, 6000)).toBe('low');
  });

  it('remaining ÷ hours left until sleep; walk minutes at 100 steps/min', () => {
    expect(stepsHint(3600, T, at(18), at(22))).toEqual({
      text: '2,400 steps left: a 24-min walk after dinner.',
      urgent: false,
    });
    expect(stepsHint(1000, T, at(10), at(22))).toEqual({
      text: '5,000 steps left: about 417 an hour until bedtime.',
      urgent: false,
    });
    expect(stepsHint(5500, T, at(20, 30), at(22))).toEqual({
      text: '500 steps left: a 5-min walk now.',
      urgent: true,
    });
    expect(stepsHint(5500, T, at(22), at(22))).toEqual({
      text: '500 steps short today.',
      urgent: true,
    });
    expect(stepsHint(7000, T, at(12), at(22)).text).toBe(
      'Minimum done. 3,000 more for the 10,000 stretch.',
    );
    expect(stepsHint(10500, T, at(12), at(22)).text).toBe('Stretch target done: 10,500 steps.');
  });
});

describe('rows', () => {
  const rows: StepsRow[] = [
    { client_id: 'a', date: '2026-11-23', steps: 5000, source: 'health' },
    { client_id: 'b', date: '2026-11-22', steps: 300, source: 'manual' },
  ];
  it('one row per day, clamped', () => {
    expect(planSteps('2026-11-24', null, 1234.6, 'manual')).toEqual([
      {
        op: 'upsert',
        table: 'steps_log',
        row: { date: '2026-11-24', steps: 1235, source: 'manual', deleted_at: null },
      },
    ]);
    expect(planSteps('2026-11-23', rows[0]!, -5, 'manual')[0]).toMatchObject({
      clientId: 'a',
      row: { steps: 0 },
    });
    expect(planSteps('2026-11-23', null, 1e9, 'manual')[0]).toMatchObject({
      row: { steps: 100000 },
    });
  });

  it('health writes only changed days; zero days without a row are skipped', () => {
    const counts = new Map([
      ['2026-11-21', 0],
      ['2026-11-22', 4200],
      ['2026-11-23', 5000],
      ['2026-11-24', 812],
    ]);
    expect(
      healthWrites(counts, rows).map((c) =>
        c.op === 'upsert' ? [c.clientId ?? null, c.row.date, c.row.steps] : null,
      ),
    ).toEqual([
      ['b', '2026-11-22', 4200],
      [null, '2026-11-24', 812],
    ]);
  });

  it('14 days and week stats (before today)', () => {
    const days = lastDays(rows, '2026-11-24');
    expect(days).toHaveLength(14);
    expect(days.slice(-3).map((d) => d.steps)).toEqual([300, 5000, null]);
    expect(weekStats(days, 6000)).toEqual({ avg7: 2650, hit7: 0 });
    expect(weekStats(lastDays([], '2026-11-24'), 6000)).toEqual({ avg7: null, hit7: 0 });
  });
});

describe('HealthKit buckets', () => {
  it('maps IST-midnight buckets to dates, fills missing days with 0', () => {
    const m = bucketsToDays(
      [
        { startDate: new Date('2026-11-22T00:00:00+05:30'), sumQuantity: { quantity: 4200.4 } },
        { startDate: '2026-11-23T00:00:00+05:30', sumQuantity: { quantity: 5000 } },
        { startDate: new Date('2026-11-01T00:00:00+05:30'), sumQuantity: { quantity: 9 } },
        { sumQuantity: { quantity: 1 } },
        { startDate: new Date('2026-11-24T00:00:00+05:30') },
      ],
      '2026-11-21',
      '2026-11-24',
    );
    expect([...m]).toEqual([
      ['2026-11-21', 0],
      ['2026-11-22', 4200],
      ['2026-11-23', 5000],
      ['2026-11-24', 0],
    ]);
  });
});
