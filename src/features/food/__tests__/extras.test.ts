import { mergeByClientId, type Mutation } from '@/lib/sync';
import { seedMealPlan } from '@/test/foodFixtures';

import { coffeeLine, coffeeState, planCoffee, planOffPlan, validateOffPlan } from '../lib/extras';
import { planRestoreMeal } from '../lib/logging';
import { dayFood, type FoodLogRow } from '../lib/plan';

const D = '2026-11-23';
const NOW = Date.parse('2026-11-23T11:00:00Z'); // 16:30 IST
const MIN = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3));
const apply = (logs: FoodLogRow[], changes: ReturnType<typeof planOffPlan>) =>
  mergeByClientId(
    logs,
    changes.map((c, i) =>
      c.op === 'upsert'
        ? ({
            client_id: c.clientId ?? `n${logs.length}-${i}`,
            table: c.table,
            op: 'upsert',
            row: c.row,
          } as Mutation)
        : ({ client_id: c.clientId, table: c.table, op: 'soft_delete', row: {} } as Mutation),
    ),
  );

describe('coffee', () => {
  it('states and lines at limit 2', () => {
    expect([0, 1, 2, 3].map((n) => coffeeState(n, 2))).toEqual(['under', 'under', 'at', 'over']);
    expect(coffeeLine(1, 2)).toBe('1 of 2. One left today.');
    expect(coffeeLine(0, 3)).toBe('0 of 3. 3 left today.');
    expect(coffeeLine(2, 2)).toBe('2 of 2. That was the last one.');
    expect(coffeeLine(3, 2)).toBe('3 of 2. Over by 1.');
    expect(coffeeLine(0, 0)).toBe('No coffee today.');
    expect(coffeeState(1, 0)).toBe('over');
  });

  it('planCoffee', () => {
    expect(planCoffee(D, NOW)).toEqual([
      {
        op: 'upsert',
        table: 'coffee_log',
        row: { date: D, logged_at: new Date(NOW).toISOString() },
      },
    ]);
  });
});

describe('off-plan (F09 AC1)', () => {
  const plan = seedMealPlan();

  it('validation', () => {
    const ok = { text: 'Masala vada ×2', kcal: 250, protein: 8 };
    expect(validateOffPlan(ok)).toBeNull();
    expect(validateOffPlan({ ...ok, protein: null })).toBeNull();
    expect(validateOffPlan({ ...ok, text: ' ' })).toMatch(/what you ate/);
    expect(validateOffPlan({ ...ok, text: 'x'.repeat(81) })).toMatch(/80/);
    expect(validateOffPlan({ ...ok, kcal: 0 })).toMatch(/1–5,000/);
    expect(validateOffPlan({ ...ok, kcal: 12.5 })).toMatch(/1–5,000/);
    expect(validateOffPlan({ ...ok, protein: -1 })).toMatch(/Protein/);
  });

  it('shows in totals and under its meal, marked off-plan; adds on top of the plan', () => {
    const snack = dayFood(plan, [], {}, MIN('16:30')).meals[2]!;
    const logs = apply(
      [],
      planOffPlan(
        { text: ' Masala vada ×2 ', kcal: 250, protein: 8, mealId: snack.meal.id, replaces: false },
        { date: D, now: NOW, meal: snack },
      ),
    );
    expect(logs).toEqual([
      expect.objectContaining({
        free_text: 'Masala vada ×2',
        kcal: 250,
        protein_g: 8,
        is_off_plan: true,
        dish_id: null,
        meal_id: 'm-snack',
      }),
    ]);
    const day = dayFood(plan, logs, {}, MIN('16:40'));
    expect(day.eaten).toMatchObject({ kcal: 250, protein: 8 });
    expect(day.meals[2]!.offPlan).toHaveLength(1);
    expect(day.meals[2]!.status).toBe('partly');
    expect(day.projected.kcal).toBe(250 + 480); // snack touched, dinner still planned
  });

  it('"Replaces planned snack" marks the planned dishes as not eaten; the meal is done', () => {
    const snack = dayFood(plan, [], {}, MIN('16:30')).meals[2]!;
    const changes = planOffPlan(
      { text: 'Samosa', kcal: 260, protein: null, mealId: snack.meal.id, replaces: true },
      { date: D, now: NOW, meal: snack },
    );
    expect(changes).toHaveLength(1 + 4);
    const day = dayFood(plan, apply([], changes), {}, MIN('16:40'));
    expect(day.meals[2]!.status).toBe('eaten');
    expect(day.meals[2]!.eaten).toEqual({ kcal: 260, protein: 0 });
  });

  it('"Other" entries sit outside the meals', () => {
    const logs = apply(
      [],
      planOffPlan(
        { text: 'Biscuits', kcal: 100, protein: null, mealId: null, replaces: true },
        { date: D, now: NOW, meal: null },
      ),
    );
    const day = dayFood(plan, logs, {}, MIN('16:40'));
    expect(day.other.map((l) => l.free_text)).toEqual(['Biscuits']);
    expect(day.eaten.kcal).toBe(100);
  });
});

describe('Undo with off-plan entries', () => {
  const plan = seedMealPlan();
  it('removes an added off-plan entry and restores a removed one', () => {
    const before = dayFood(plan, [], {}, MIN('20:05')).meals[3]!;
    const logs = apply(
      [],
      planOffPlan(
        { text: 'Biryani', kcal: 500, protein: null, mealId: before.meal.id, replaces: true },
        { date: D, now: NOW, meal: before },
      ),
    );
    const after = dayFood(plan, logs, {}, MIN('20:05')).meals[3]!;
    const undo = planRestoreMeal(before, after);
    expect(undo.filter((c) => c.op === 'delete')).toHaveLength(4);
    expect(planRestoreMeal(after, before).filter((c) => c.op === 'upsert')).toHaveLength(4);
  });
});
