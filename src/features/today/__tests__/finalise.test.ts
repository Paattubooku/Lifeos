import { seedRoutine } from '@/test/routineFixtures';

import { datesToFinalise, planDayScore, scoreForDate } from '../lib/finalise';

const { templates, blocks } = seedRoutine();
const MON = '2026-11-23';
const empty = { blockLogs: [], water: [], food: [], sessions: [] };
const program = { program: null, days: [], overrides: [] };
const plan = { meals: [{ id: 'ml', slot: 'lunch' }], items: [], dishes: [] };
const ctx = {
  templates,
  blocks,
  dayLog: null,
  logs: empty,
  mealPlan: plan,
  program,
  waterTargetMl: 3000,
};

describe('scoreForDate', () => {
  it('nothing logged → 0 on Workday', () => {
    expect(scoreForDate(MON, ctx)).toEqual({ score: 0, templateId: 'workday' });
  });

  it('counts ticks, water and meals of that date only', () => {
    const wake = blocks.find((b) => b.template_id === 'workday' && b.kind === 'wake')!;
    const logs = {
      blockLogs: [
        { client_id: 'a', block_id: wake.id, status: 'done', date: MON },
        { client_id: 'b', block_id: 'other', status: 'done', date: MON },
        { client_id: 'c', block_id: wake.id, status: 'done', date: '2026-11-22' },
      ],
      water: [{ date: MON, amount_ml: 3000, logged_at: '2026-11-23T03:00:00Z' }],
      food: [{ date: MON, meal_id: 'ml', dish_id: 'd', portion: 1, kcal: 1, protein_g: 1 }],
      sessions: [{ date: MON, completion: 90 }],
    };
    // wake + drink + water target + lunch = 4 of 11
    expect(scoreForDate(MON, { ...ctx, logs }).score).toBe(36);
    const withProgram = {
      ...ctx,
      logs,
      program: {
        program: { start_date: null },
        days: [{ id: 'd1', weekday: 1, title: 'Upper A', kind: 'strength' }],
        overrides: [],
      },
    };
    expect(scoreForDate(MON, withProgram).score).toBe(45); // + workout at 90 %
  });

  it('uses the day’s switched template', () => {
    expect(scoreForDate(MON, { ...ctx, dayLog: { template_id: 'rest' } }).templateId).toBe('rest');
  });
});

describe('planDayScore', () => {
  it('writes score + is_streak_day; no-op when unchanged; keeps a manual template', () => {
    expect(planDayScore(MON, null, 72, 'workday')).toEqual([
      {
        op: 'upsert',
        table: 'day_log',
        row: {
          date: MON,
          score: 72,
          is_streak_day: true,
          deleted_at: null,
          template_id: 'workday',
        },
      },
    ]);
    const row = { client_id: 'dl', date: MON, score: 72, is_streak_day: true, template_id: 'rest' };
    expect(planDayScore(MON, row, 72, 'workday')).toEqual([]);
    expect(planDayScore(MON, row, 69, 'workday')).toEqual([
      {
        op: 'upsert',
        table: 'day_log',
        clientId: 'dl',
        row: { date: MON, score: 69, is_streak_day: false, deleted_at: null },
      },
    ]);
    expect(planDayScore(MON, { ...row, deleted_at: 'x' }, 72, null)[0]).toMatchObject({
      clientId: 'dl',
      row: { deleted_at: null },
    });
    expect(planDayScore(MON, null, 10, null)[0]).not.toHaveProperty('row.template_id');
  });
});

describe('datesToFinalise', () => {
  const row = (date: string, score: number | null, deleted_at: string | null = null) => ({
    client_id: date,
    date,
    score,
    is_streak_day: null,
    template_id: null,
    deleted_at,
  });

  it('unscored days and a missing yesterday; scored days are left alone; nothing before first use', () => {
    expect(datesToFinalise(MON, [row('2026-11-20', 80), row('2026-11-22', 75)])).toEqual([]);
    expect(datesToFinalise(MON, [row('2026-11-22', null)])).toEqual(['2026-11-22']);
    expect(datesToFinalise(MON, [])).toEqual([]);
    expect(datesToFinalise(MON, [row(MON, null)])).toEqual([]);
    expect(
      datesToFinalise(MON, [
        row('2026-11-14', null),
        row('2026-11-15', null),
        row('2026-11-18', 80),
        row('2026-11-19', null),
        row('2026-11-20', null, 'x'),
      ]),
    ).toEqual(['2026-11-15', '2026-11-19', '2026-11-22']);
  });
});
