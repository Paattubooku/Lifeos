import { addDays } from '@/lib/dates';

import { ageFromBirthYear, bmr, energyLine, energyZone, measuredTdee, tdee } from '../lib/energy';
import { intakeProjection, linearRegression, trendProjection } from '../lib/projection';
import { avgOn, inRange, previewAvg, weightStats, withAvg7, type WeightRow } from '../lib/weight';

const TODAY = '2026-12-27';
const rows = (start: string, ...kgs: (number | null)[]): WeightRow[] =>
  kgs.flatMap((kg, i) => (kg === null ? [] : [{ date: addDays(start, i), weight_kg: kg }]));

describe('F13 AC1: 7-day average like v_weight_trend', () => {
  it('mean of weigh-ins in [date − 6, date], 2 decimals; gaps and deleted rows handled', () => {
    const r = [
      ...rows('2026-12-01', 91, 90.8, null, 90.5, 90.4, 90.1, 90.2, 89.9),
      { date: '2026-12-05', weight_kg: 50, deleted_at: 'x' },
    ];
    const p = withAvg7(r);
    expect(p.map((x) => x.avg7)).toEqual([91, 90.9, 90.77, 90.68, 90.56, 90.5, 90.32]);
    // Dec 8: window Dec 2–8 → 90.8, 90.5, 90.4, 90.1, 90.2, 89.9
    expect(p.at(-1)).toMatchObject({ date: '2026-12-08', avg7: 90.32 });
    expect(avgOn(p, '2026-12-03')).toBe(90.9);
    expect(avgOn(p, '2026-11-01')).toBeNull();
  });

  it('salty-dinner notes are kept as markers (A20)', () => {
    expect(withAvg7([{ date: TODAY, weight_kg: '88.2', note: 'salty' }])[0]).toMatchObject({
      weight: 88.2,
      salty: true,
    });
  });
});

describe('stats, ranges, preview', () => {
  const p = withAvg7(
    rows(addDays(TODAY, -20), ...Array.from({ length: 21 }, (_, i) => 91 - i * 0.1)),
  );
  it('avg, change vs 7 days ago, total since first', () => {
    const s = weightStats(p, TODAY, 91);
    expect(s.avg7).toBe(89.3);
    expect(s.change7).toBe(-0.7);
    expect(s.totalLost).toBe(-1.7);
    expect(s.since).toBe(addDays(TODAY, -20));
    expect(weightStats([], TODAY, 91)).toMatchObject({
      avg7: null,
      change7: null,
      totalLost: null,
    });
  });

  it('ranges and the weigh-in preview', () => {
    expect(inRange(p, TODAY, '4W')).toHaveLength(21);
    expect(inRange(p, TODAY, '12W')).toHaveLength(21);
    expect(inRange(p, addDays(TODAY, 30), '4W')).toHaveLength(0);
    expect(inRange(p, TODAY, 'All')).toHaveLength(21);
    expect(previewAvg(p, TODAY, 88.2)).toEqual({ avg7: 89.2, change7: -0.8 });
    expect(previewAvg([], TODAY, 88.2)).toEqual({ avg7: 88.2, change7: null });
  });
});

describe('F13 AC2: projection', () => {
  it('regression matches the reference implementation (Food-Tracker prediction.js) for the same inputs', () => {
    const at = (ys: number[]) => linearRegression(ys.map((y, x) => ({ x, y })));
    // Expected values produced by running the reference code on these inputs.
    expect(at([91, 90.8, 90.9, 90.5, 90.4, 90.1, 90.2]).slope).toBeCloseTo(
      -0.15357142857143044,
      12,
    );
    expect(at([91, 90.8, 90.9, 90.5, 90.4, 90.1, 90.2]).intercept).toBeCloseTo(
      91.01785714285715,
      12,
    );
    expect(at([88, 88, 88])).toEqual({ slope: 0, intercept: 88 });
    expect(at([85.2, 85.6, 85.1, 85.9, 86.0]).slope).toBeCloseTo(0.19, 12);
    expect(at([85.2, 85.6, 85.1, 85.9, 86.0]).intercept).toBeCloseTo(85.18, 12);
    expect(linearRegression([])).toEqual({ slope: 0, intercept: 0 });
    expect(linearRegression([{ x: 3, y: 5 }])).toEqual({ slope: 0, intercept: 5 });
  });

  it('hidden with < 14 data points in the last 28 days', () => {
    const few = withAvg7(rows(addDays(TODAY, -12), ...Array.from({ length: 13 }, () => 90)));
    expect(trendProjection(few, TODAY, 75)).toEqual({ status: 'not_enough', points: 13 });
  });

  it('losing 0.1 kg/day → kg/week and the date the trend reaches 75 kg; flat or rising', () => {
    const p = withAvg7(
      rows(addDays(TODAY, -27), ...Array.from({ length: 28 }, (_, i) => 90 - i * 0.1)),
    );
    const t = trendProjection(p, TODAY, 75);
    // 7-day averages lag at the start of the window, so the fitted slope is a bit under −0.1/day.
    expect(t).toMatchObject({ status: 'ok', kgPerWeek: -0.65, reached: false });
    if (t.status === 'ok') expect(t.days).toBeGreaterThan(100);
    const up = withAvg7(
      rows(addDays(TODAY, -27), ...Array.from({ length: 28 }, (_, i) => 80 + i * 0.05)),
    );
    expect(trendProjection(up, TODAY, 75).status).toBe('flat');
    const there = withAvg7(
      rows(addDays(TODAY, -27), ...Array.from({ length: 28 }, (_, i) => 76 - i * 0.1)),
    );
    expect(trendProjection(there, TODAY, 75)).toMatchObject({
      status: 'ok',
      reached: true,
      days: 0,
    });
  });

  it('intake method: avg deficit over the last 14 complete days ÷ 7,700', () => {
    const intake = new Map(
      Array.from({ length: 14 }, (_, i) => [addDays(TODAY, -1 - i), 2010] as [string, number]),
    );
    intake.set(TODAY, 500); // today isn't counted
    expect(intakeProjection(intake, 2530, 88.4, 75, TODAY)).toMatchObject({
      status: 'ok',
      deficit: 520,
      kgPerWeek: 0.47,
    });
    expect(intakeProjection(new Map([[addDays(TODAY, -1), 2000]]), 2530, 88.4, 75, TODAY)).toEqual({
      status: 'not_enough',
      days: 1,
    });
    expect(intakeProjection(intake, 1900, 88.4, 75, TODAY)).toEqual({
      status: 'flat',
      deficit: -110,
    });
    expect(intakeProjection(intake, 2530, null, 75, TODAY).status).toBe('not_enough');
  });
});

describe('F13 AC3: BMR (Mifflin-St Jeor), energy zones', () => {
  it('91 kg, 170 cm, 29 y, male = 1,833; 88.4 kg = 1,807; age = year − birth year', () => {
    expect(bmr({ sex: 'male', weightKg: 91, heightCm: 170, age: 29 })).toBe(1833);
    expect(bmr({ sex: 'male', weightKg: 88.4, heightCm: 170, age: 29 })).toBe(1807);
    expect(ageFromBirthYear(1997, 2026)).toBe(29);
    expect(tdee(1807, 1.4)).toBe(2530);
  });

  it('zones < 300 / 300–700 / > 700 with one-line fixes', () => {
    expect([-50, 140, 299, 300, 700, 701].map(energyZone)).toEqual([
      'surplus',
      'small',
      'small',
      'target',
      'target',
      'aggressive',
    ]);
    expect(energyLine(520)).toBe('520 kcal ≈ 0.47 kg/week. Keep it here.');
    expect(energyLine(140)).toBe(
      '140 kcal ≈ 0.13 kg/week. Cut ~250 kcal: drop 1 chapati and the peanuts.',
    );
    expect(energyLine(1150)).toMatch(
      /^1150 kcal ≈ 1.05 kg\/week\. Expect muscle loss .* Eat ~550 kcal more/,
    );
    expect(energyLine(-120)).toBe('120 kcal over TDEE today. Back to the plan tomorrow.');
  });

  it('measured TDEE = avg intake + (−trend kg/day × 7,700)', () => {
    expect(measuredTdee(2200, -0.075)).toBe(2778);
  });
});
