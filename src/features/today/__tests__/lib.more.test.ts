import type { Mutation } from '@/lib/sync';

import { eatenSlots, foodTotals, mealSummary } from '../lib/meals';
import { live, mergeKeepingDeleted } from '../lib/merge';
import { dayKicker, rowText, timeParts } from '../lib/present';

const plan = {
  meals: [
    { id: 'm-b', slot: 'breakfast' },
    { id: 'm-l', slot: 'lunch' },
  ],
  items: [
    { meal_id: 'm-b', dish_id: 'idli', is_default: true, sort: 0 },
    { meal_id: 'm-b', dish_id: 'eggs', is_default: true, sort: 1 },
    { meal_id: 'm-b', dish_id: 'dosa', is_default: false, sort: 2 },
    { meal_id: 'm-l', dish_id: 'gone', is_default: true, sort: 0 },
  ],
  dishes: [
    { id: 'idli', name: 'Idli', kcal: 240, protein_g: '8' },
    { id: 'eggs', name: 'Eggs', kcal: 150, protein_g: 12.4 },
    { id: 'dosa', name: 'Dosa', kcal: 300, protein_g: 6 },
  ],
};
const food = (over: object) => ({
  meal_id: 'm-b',
  dish_id: 'dosa',
  portion: 1,
  kcal: 300,
  protein_g: 6,
  ...over,
});

describe('meals', () => {
  it('eatenSlots: portion > 0 with a planned meal', () => {
    expect([
      ...eatenSlots(
        [food({}), food({ meal_id: 'm-l', portion: 0 }), food({ meal_id: null })],
        plan,
      ),
    ]).toEqual(['breakfast']);
  });

  it('mealSummary: eaten food first, else the plan defaults', () => {
    expect(mealSummary('breakfast', [], plan)).toEqual({
      names: ['Idli', 'Eggs'],
      kcal: 390,
      protein: 20,
      eaten: false,
    });
    expect(
      mealSummary(
        'breakfast',
        [
          food({}),
          food({ dish_id: null, free_text: 'Banana', kcal: 90, protein_g: '1' }),
          food({ dish_id: 'x' }),
        ],
        plan,
      ),
    ).toEqual({ names: ['Dosa', 'Banana', 'Food'], kcal: 690, protein: 13, eaten: true });
    expect(mealSummary('lunch', [], plan)).toBeNull(); // default dish missing
    expect(mealSummary('dinner', [], plan)).toBeNull();
    expect(mealSummary(null, [], plan)).toBeNull();
  });

  it('foodTotals', () => {
    expect(foodTotals([food({}), food({ kcal: 100, protein_g: '4.6' })])).toEqual({
      kcal: 400,
      protein: 11,
    });
  });
});

describe('mergeKeepingDeleted', () => {
  const w = (over: Partial<Mutation>): Mutation =>
    ({
      client_id: 'a',
      table: 'block_log',
      op: 'upsert',
      row: {},
      owner: 'u',
      attempts: 0,
      next_try_at: 0,
      enqueued_at: 0,
      rev: 0,
      ...over,
    }) as Mutation;

  it('keeps deleted rows marked, applies upserts, adds new rows', () => {
    const rows = [
      { client_id: 'a', status: 'done', deleted_at: null as string | null },
      { client_id: 'b', status: 'done', deleted_at: null as string | null },
    ];
    const merged = mergeKeepingDeleted(rows, [
      w({ op: 'soft_delete', row: { deleted_at: '2026-11-23T00:00:00Z' } }),
      w({ client_id: 'b', row: { status: 'skipped' } }),
      w({ client_id: 'c', row: { status: 'done' } }),
      w({ client_id: 'zz', op: 'soft_delete', row: {} }),
    ]);
    expect(merged).toEqual([
      { client_id: 'a', status: 'done', deleted_at: '2026-11-23T00:00:00Z' },
      { client_id: 'b', status: 'skipped', deleted_at: null },
      { client_id: 'c', status: 'done' },
    ]);
    expect(live(merged).map((r) => r.client_id)).toEqual(['b', 'c']);
    expect(
      mergeKeepingDeleted(rows.slice(0, 1), [w({ op: 'soft_delete', row: {} })])[0]?.deleted_at,
    ).toBe('deleted');
  });
});

describe('present', () => {
  it('dayKicker / timeParts', () => {
    expect(dayKicker('2026-11-23', 1, 5, 11)).toBe('MON 23 NOV · 5 OF 11 DONE');
    expect(timeParts('13:00:00')).toEqual({ time: '1:00', period: 'PM' });
  });

  it('rowText: rest day workout, optional without duration, done without time', () => {
    const block = {
      id: 'w',
      client_id: 'w',
      template_id: 't',
      title: 'Workout',
      kind: 'workout' as const,
      start_time: '05:30:00',
      duration_min: 60,
      ref_slot: null,
      auto_complete: true,
      is_optional: false,
      notify: true,
      sort: 0,
    };
    const ctx = {
      nowMin: 300,
      session: { title: 'Rest', kind: 'rest' },
      exercises: [],
      meal: () => null,
    };
    const auto = { done: true, at: null, hint: 'Rest day — nothing to do' };
    expect(rowText({ block, log: null, auto, state: 'done' }, ctx, false)).toMatchObject({
      title: 'Workout',
      sub: 'Rest day — nothing to do',
    });
    const walk = {
      ...block,
      kind: 'custom' as const,
      title: 'Walk',
      is_optional: true,
      duration_min: 0,
    };
    expect(
      rowText(
        { block: walk, log: null, auto: { done: false, at: null, hint: null }, state: 'upcoming' },
        { ...ctx, session: null },
        true,
      ),
    ).toEqual({
      title: 'Walk',
      sub: 'Optional · not counted',
      late: false,
      pill: 'next',
    });
    const strength = {
      ...ctx,
      session: { title: 'Upper A', kind: 'strength' },
      exercises: ['Bench'],
    };
    expect(
      rowText(
        { block, log: null, auto: { done: false, at: null, hint: null }, state: 'overdue' },
        { ...strength, nowMin: 500 },
        false,
      ),
    ).toEqual({
      title: 'Workout · Upper A',
      sub: '1 exercise · 60 min · 1 h 50 min late',
      late: true,
      pill: null,
    });
    expect(
      rowText(
        {
          block,
          log: { client_id: 'l', block_id: 'w', status: 'skipped', skip_reason: null },
          auto: { done: false, at: null, hint: null },
          state: 'skipped',
        },
        strength,
        false,
      ).sub,
    ).toBe('Skipped');
    expect(
      rowText(
        {
          block: { ...block, duration_min: 0 },
          log: null,
          auto: { done: false, at: null, hint: null },
          state: 'upcoming',
        },
        { ...strength, exercises: [] },
        false,
      ).sub,
    ).toBe('0 min');
  });
});
