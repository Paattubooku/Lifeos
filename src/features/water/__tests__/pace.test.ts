import { addDays } from '@/lib/dates';

import {
  classifyUrgency,
  expectedBy,
  suggestedAmount,
  validateAmount,
  waterPace,
} from '../lib/pace';
import { dailyTotals, waterStats } from '../lib/stats';
import { paceLine, showBehind } from '../lib/copy';

const m = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));
const base = { wakeMin: m('05:00'), targetMin: m('21:00'), sleepMin: m('22:00'), targetMl: 3000 };

describe('F07 AC1: expected intake', () => {
  it('13:00 → 1,500 ml; 14:20 → 1,750 ml', () => {
    expect(expectedBy(m('13:00'), base.wakeMin, base.targetMin, 3000)).toBe(1500);
    expect(expectedBy(m('14:20'), base.wakeMin, base.targetMin, 3000)).toBe(1750);
  });

  it('boundaries: 0 at/before wake, full at/after the target block', () => {
    expect(expectedBy(m('04:00'), base.wakeMin, base.targetMin, 3000)).toBe(0);
    expect(expectedBy(m('05:00'), base.wakeMin, base.targetMin, 3000)).toBe(0);
    expect(expectedBy(m('21:00'), base.wakeMin, base.targetMin, 3000)).toBe(3000);
    expect(expectedBy(m('21:45'), base.wakeMin, base.targetMin, 3000)).toBe(3000);
    expect(expectedBy(m('12:00'), m('21:00'), m('21:00'), 3000)).toBe(3000);
  });
});

describe('F07 AC2: urgency and suggestion', () => {
  it('gap 180 → low, 200; gap 620 → high, 500', () => {
    expect(classifyUrgency(180)).toBe('low');
    expect(suggestedAmount(180)).toBe(200);
    expect(classifyUrgency(620)).toBe('high');
    expect(suggestedAmount(620)).toBe(500);
  });

  it('200 / 500 ml boundaries and the 50 ml floor', () => {
    expect(classifyUrgency(200)).toBe('low');
    expect(classifyUrgency(201)).toBe('medium');
    expect(classifyUrgency(500)).toBe('medium');
    expect(classifyUrgency(501)).toBe('high');
    expect(suggestedAmount(10)).toBe(50);
    expect(suggestedAmount(374)).toBe(350);
    expect(suggestedAmount(375)).toBe(400);
  });
});

describe('waterPace status', () => {
  const pace = (now: string, actual: number) =>
    waterPace({ ...base, nowMin: m(now), actualMl: actual });

  it('behind / on track / goal / sleeping', () => {
    expect(pace('14:20', 1400)).toEqual({
      status: 'behind',
      expected: 1750,
      gap: 350,
      urgency: 'medium',
      suggested: 350,
    });
    expect(pace('14:20', 1800).status).toBe('on_track');
    expect(pace('14:20', 1750).status).toBe('on_track');
    expect(pace('14:20', 3000).status).toBe('goal_reached');
    expect(pace('04:30', 0).status).toBe('sleeping');
    expect(pace('22:00', 2000).status).toBe('sleeping');
    expect(pace('21:59', 2000).status).toBe('behind');
  });
});

describe('F07 AC3: entry validation', () => {
  it('rejects outside 1–2,000 ml and fractions', () => {
    expect(validateAmount(1)).toBeNull();
    expect(validateAmount(2000)).toBeNull();
    expect(validateAmount(0)).toMatch(/At least/);
    expect(validateAmount(2001)).toMatch(/2,000/);
    expect(validateAmount(12.5)).toMatch(/whole/);
    expect(validateAmount(Number.NaN)).toMatch(/whole/);
  });
});

describe('waterStats (port of getStats)', () => {
  const TODAY = '2026-11-23';
  const totals = (byDaysAgo: Record<number, number>) =>
    dailyTotals(
      Object.entries(byDaysAgo).map(([ago, ml]) => ({
        date: addDays(TODAY, -Number(ago)),
        amount_ml: ml,
      })),
    );

  it('dailyTotals sums per day', () => {
    expect([
      ...dailyTotals([
        { date: 'a', amount_ml: 200 },
        { date: 'a', amount_ml: 300 },
        { date: 'b', amount_ml: 5 },
      ]),
    ]).toEqual([
      ['a', 500],
      ['b', 5],
    ]);
  });

  it('today in progress does not break the streak; streaks can exceed 7 days', () => {
    const t: Record<number, number> = { 0: 1200 };
    for (let i = 1; i <= 10; i++) t[i] = 3000;
    const s = waterStats(totals(t), TODAY, 3000);
    expect(s.current).toBe(10);
    expect(s.best).toEqual({ days: 10, end: addDays(TODAY, -1) });
    expect(waterStats(totals({ ...t, 0: 3100 }), TODAY, 3000).current).toBe(11);
  });

  it('a short past day breaks; last 7 days, average, hits', () => {
    const s = waterStats(
      totals({ 1: 3000, 2: 2800, 3: 3100, 4: 3000, 9: 3000, 10: 3000, 11: 3000 }),
      TODAY,
      3000,
    );
    expect(s.current).toBe(1);
    expect(s.best).toEqual({ days: 3, end: addDays(TODAY, -9) });
    expect(s.last7.map((x) => x.ml)).toEqual([0, 0, 0, 3000, 3100, 2800, 3000]);
    expect(s.avg7).toBe(1700);
    expect(s.hit7).toBe(3);
    expect(waterStats(new Map(), TODAY, 3000)).toMatchObject({
      current: 0,
      best: null,
      avg7: 0,
      hit7: 0,
    });
  });
});

describe('paceLine', () => {
  const ctx = {
    totalMl: 1400,
    targetMl: 3000,
    targetTime: '21:00',
    wakeTime: '05:00',
    beforeWake: false,
  };
  const p = (over: object) =>
    ({ status: 'on_track', expected: 0, gap: 0, urgency: 'low', suggested: 50, ...over }) as never;

  it('each status', () => {
    expect(paceLine(p({ status: 'behind', gap: 350, suggested: 350 }), ctx)).toEqual({
      text: '350 ml behind. Drink 350 ml now.',
      tone: 'danger',
    });
    expect(paceLine(p({ status: 'behind', gap: 20 }), ctx).text).toBe(
      'On pace. 1,600 ml left by 9:00 pm.',
    );
    expect(paceLine(p({}), ctx).tone).toBe('secondary');
    expect(paceLine(p({ status: 'goal_reached' }), { ...ctx, totalMl: 3100 })).toEqual({
      text: 'Goal hit · 3,100 ml today.',
      tone: 'success',
    });
    expect(paceLine(p({ status: 'sleeping' }), { ...ctx, beforeWake: true }).text).toBe(
      'Pace starts at 5:00 am.',
    );
    expect(paceLine(p({ status: 'sleeping' }), ctx).text).toBe(
      '1,400 ml today. Pace is off for the night.',
    );
    expect(paceLine(p({ status: 'on_track' }), { ...ctx, totalMl: 3200 }).text).toBe(
      'On pace. 0 ml left by 9:00 pm.',
    );
  });

  it('showBehind', () => {
    expect(showBehind(p({ status: 'behind', gap: 50 }))).toBe(true);
    expect(showBehind(p({ status: 'behind', gap: 49 }))).toBe(false);
    expect(showBehind(p({ status: 'on_track', gap: 500 }))).toBe(false);
  });
});
