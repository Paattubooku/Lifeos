import { mergeByClientId, type Mutation } from '@/lib/sync';
import { seedMealPlan } from '@/test/foodFixtures';

import {
  planEatMeal,
  planMakeDefault,
  planPortion,
  planRestoreMeal,
  planSwapEaten,
  planToggleDish,
  planUneatMeal,
  signed,
} from '../lib/logging';
import { dayFood, type FoodLogRow, mealView, scaled } from '../lib/plan';

const D = '2026-11-23';
const NOW = Date.parse('2026-11-23T15:00:00Z');
const MIN = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3));

/** Apply planned changes as the app does: queued writes merged over rows. */
function apply(logs: FoodLogRow[], changes: ReturnType<typeof planEatMeal>): FoodLogRow[] {
  const writes = changes.map((c, i) =>
    c.op === 'upsert'
      ? ({
          client_id: c.clientId ?? `new-${logs.length}-${i}`,
          table: c.table,
          op: 'upsert',
          row: c.row,
        } as Mutation)
      : ({ client_id: c.clientId, table: c.table, op: 'soft_delete', row: {} } as Mutation),
  );
  return mergeByClientId(logs, writes);
}

describe('the seeded day', () => {
  const plan = seedMealPlan();

  it('planned day = 2,219 kcal / 157 g; meals in time order with their default dishes', () => {
    const day = dayFood(plan, [], {}, MIN('06:00'));
    expect(day.meals.map((m) => [m.name, m.planned.kcal, m.planned.protein])).toEqual([
      ['Breakfast', 634, 40],
      ['Lunch', 700, 58],
      ['Snack', 405, 21],
      ['Dinner', 480, 38],
    ]);
    expect(day.planned).toEqual({ kcal: 2219, protein: 157 });
    expect(day.meals[0]!.groups.map((g) => g.dish.name)).toEqual([
      'Idli',
      'Sambar',
      'Boiled eggs + whites',
    ]);
    expect(day.meals[0]!.groups[0]!.alternatives.map((d) => d.name)).toEqual([
      'Dosa',
      'Pesarattu',
      'Ragi dosa',
    ]);
  });

  it('F08 AC1: ticking all 4 meals as planned → ≈2,220 kcal / ≈157 g', () => {
    let logs: FoodLogRow[] = [];
    for (const m of dayFood(plan, [], {}, MIN('21:00')).meals)
      logs = apply(logs, planEatMeal(m, D, NOW));
    const day = dayFood(plan, logs, {}, MIN('21:00'));
    expect(logs).toHaveLength(14); // one row per swap group
    expect(day.eaten.kcal).toBe(2219);
    expect(day.eaten.protein).toBe(157);
    expect(day.meals.every((m) => m.status === 'eaten')).toBe(true);
    expect(day.projected).toEqual({ kcal: 2219, protein: 157 });
  });

  it('F08 AC2: swapping Idli → Dosa at breakfast adds 90 kcal (before and after eating)', () => {
    const before = dayFood(plan, [], {}, MIN('06:00'));
    const swapped = dayFood(
      plan,
      [],
      { 'm-breakfast': { base: 'd-breakfast-dosa' } },
      MIN('06:00'),
    );
    expect(swapped.planned.kcal - before.planned.kcal).toBe(90);

    const breakfast = before.meals[0]!;
    let logs = apply([], planEatMeal(breakfast, D, NOW));
    const eatenView = mealView(breakfast.meal, plan, logs, {}, MIN('08:00'));
    const dosa = plan.dishes.find((d) => d.id === 'd-breakfast-dosa')!;
    logs = apply(logs, planSwapEaten(eatenView, eatenView.groups[0]!, dosa, D, NOW));
    expect(dayFood(plan, logs, {}, MIN('08:00')).eaten.kcal).toBe(634 + 90);
    expect(planSwapEaten(breakfast, breakfast.groups[0]!, dosa, D, NOW)).toEqual([]); // nothing eaten → no log
  });

  it('F08 AC3: editing a dish’s kcal does not change a past day’s totals', () => {
    const logs = apply([], planEatMeal(dayFood(plan, [], {}, 0).meals[0]!, '2026-11-22', NOW));
    const edited = {
      ...plan,
      dishes: plan.dishes.map((d) => (d.name === 'Idli' ? { ...d, kcal: 999 } : d)),
    };
    expect(dayFood(edited, logs, {}, MIN('21:00')).eaten.kcal).toBe(634);
    expect(dayFood(edited, [], {}, MIN('06:00')).planned.kcal).toBe(2219 - 240 + 999); // from today on
  });
});

describe('ticks and portions', () => {
  const plan = seedMealPlan();
  const lunch = () => dayFood(plan, [], {}, MIN('13:10')).meals[1]!;

  it('status: upcoming → now → missed; partly; eaten', () => {
    expect(dayFood(plan, [], {}, MIN('12:00')).meals[1]!.status).toBe('upcoming');
    expect(lunch().status).toBe('now');
    expect(dayFood(plan, [], {}, MIN('14:00')).meals[1]!.status).toBe('missed');
    const logs = apply([], planToggleDish(lunch(), lunch().groups[0]!, D, NOW));
    const v = mealView(lunch().meal, plan, logs, {}, MIN('14:00'));
    expect(v.status).toBe('partly');
    expect(v.eaten).toEqual({ kcal: 210, protein: 4 });
    expect(v.tickedAt).toBe(new Date(NOW).toISOString());
  });

  it('portion ½ scales kcal and protein; None keeps a 0 row; untick removes it', () => {
    let logs = apply([], planEatMeal(lunch(), D, NOW));
    let v = mealView(lunch().meal, plan, logs, {}, MIN('14:00'));
    logs = apply(logs, planPortion(v, v.groups[0]!, 0.5, D, NOW));
    v = mealView(lunch().meal, plan, logs, {}, MIN('14:00'));
    expect(v.groups[0]!.portion).toBe(0.5);
    expect(v.eaten.kcal).toBe(700 - 105);
    expect(v.status).toBe('partly');
    logs = apply(logs, planPortion(v, v.groups[3]!, 0, D, NOW));
    v = mealView(lunch().meal, plan, logs, {}, MIN('14:00'));
    expect(v.eaten.kcal).toBe(700 - 105 - 90);
    logs = apply(logs, planToggleDish(v, v.groups[2]!, D, NOW));
    v = mealView(lunch().meal, plan, logs, {}, MIN('14:00'));
    expect(v.groups[2]!.log).toBeNull();
    // portion on a dish not yet ticked creates its log
    const fresh = lunch();
    expect(planPortion(fresh, fresh.groups[0]!, 0.75, D, NOW)[0]).toMatchObject({
      op: 'upsert',
      row: { portion: 0.75, kcal: 158, protein_g: 3 },
    });
    expect(planUneatMeal(v)).toHaveLength(3);
  });

  it('scaled rounds like the DB', () => {
    expect(scaled({ kcal: 245, protein_g: '7.3', carbs_g: 10, fat_g: 1 }, 0.75)).toEqual({
      kcal: 184,
      protein: 5.5,
      carbs: 7.5,
      fat: 0.8,
    });
  });

  it('pace = planned kcal of meals already due; projection = eaten + untouched meals', () => {
    const day = dayFood(plan, [], {}, MIN('13:30'));
    expect(day.pace).toEqual({ kcal: 634 + 700, protein: 40 + 58 });
    expect(day.projected).toEqual({ kcal: 700 + 405 + 480, protein: 58 + 21 + 38 }); // breakfast missed
  });

  it('a meal without items; off-plan logs count in the meal (F09)', () => {
    const p = { ...plan, items: plan.items.filter((i) => i.meal_id !== 'm-snack') };
    expect(dayFood(p, [], {}, 0).meals[2]!.groups).toEqual([]);
    const off: FoodLogRow = {
      client_id: 'x',
      date: D,
      meal_id: 'm-lunch',
      dish_id: null,
      swap_group: null,
      portion: 1,
      kcal: 300,
      protein_g: 0,
      is_off_plan: true,
      logged_at: '2026-11-23T08:00:00Z',
      free_text: 'Samosa',
    };
    const day = dayFood(plan, [off], {}, MIN('13:10'));
    expect(day.meals[1]!.status).toBe('partly');
    expect(day.meals[1]!.offPlan.map((l) => l.free_text)).toEqual(['Samosa']);
    expect(day.meals[1]!.eaten.kcal).toBe(300);
    expect(day.other).toEqual([]);
    expect(day.eaten.kcal).toBe(300);
    expect(day.eaten.carbs).toBe(0);
  });
});

describe('make default', () => {
  const plan = seedMealPlan();

  it('clears the old default first, then sets the new one; no-op when already default', () => {
    expect(planMakeDefault(plan.items, 'm-breakfast', 'base', 'd-breakfast-dosa')).toEqual([
      {
        op: 'upsert',
        table: 'meal_item',
        clientId: 'i-breakfast-idli-c',
        row: { is_default: false },
      },
      {
        op: 'upsert',
        table: 'meal_item',
        clientId: 'i-breakfast-dosa-c',
        row: { is_default: true },
      },
    ]);
    expect(planMakeDefault(plan.items, 'm-breakfast', 'base', 'd-breakfast-idli')).toEqual([]);
    expect(planMakeDefault(plan.items, 'm-breakfast', 'base', 'nope')).toEqual([]);
  });

  it('signed deltas', () => {
    expect(signed(90, ' kcal')).toBe('+90 kcal');
    expect(signed(0, ' g')).toBe('±0 g');
    expect(signed(-1, ' g')).toBe('−1 g');
  });
});

describe('planRestoreMeal (Undo)', () => {
  const plan = seedMealPlan();
  const view = (logs: FoodLogRow[]) => mealView(plan.meals[1]!, plan, logs, {}, MIN('14:00'));

  it('removes logs that were added and restores ones that changed or went away', () => {
    const before = view([]);
    let logs = apply([], planEatMeal(before, D, NOW));
    expect(planRestoreMeal(before, view(logs)).map((c) => c.op)).toEqual([
      'delete',
      'delete',
      'delete',
      'delete',
    ]);

    const eaten = view(logs);
    logs = apply(logs, planPortion(eaten, eaten.groups[0]!, 0.5, D, NOW));
    logs = apply(logs, planToggleDish(view(logs), view(logs).groups[1]!, D, NOW));
    const undo = planRestoreMeal(eaten, view(logs));
    expect(undo).toHaveLength(2);
    expect(undo[0]).toMatchObject({
      op: 'upsert',
      row: { portion: 1, kcal: 210, deleted_at: null },
    });
    expect(undo[1]).toMatchObject({
      op: 'upsert',
      row: { dish_id: 'd-lunch-chicken-curry', deleted_at: null },
    });
    expect(planRestoreMeal(eaten, eaten)).toEqual([]);
  });
});
