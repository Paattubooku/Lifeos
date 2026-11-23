import type { MealPlanFull } from '@/features/food/lib/plan';

type Row = [string, string, string, string, number, number, number, number, string, boolean];

/** PRD §6.3 "Fixed Day v1", exactly as `seed_defaults()` creates it. */
const SEED: Row[] = [
  ['breakfast', 'base', 'Idli', '4 pcs', 240, 8, 50, 1, 'daily', true],
  ['breakfast', 'base', 'Dosa', '3 pcs', 330, 8, 54, 9, 'daily', false],
  ['breakfast', 'base', 'Pesarattu', '2 pcs', 300, 16, 40, 8, 'weekly', false],
  ['breakfast', 'base', 'Ragi dosa', '3 pcs', 270, 7, 50, 5, 'weekly', false],
  ['breakfast', 'side', 'Sambar', '1 cup', 150, 7, 20, 4, 'weekly', true],
  [
    'breakfast',
    'protein',
    'Boiled eggs + whites',
    '3 whole + 2 whites',
    244,
    25,
    1,
    15,
    'weekly',
    true,
  ],
  ['breakfast', 'protein', 'Egg podimas', '3 whole + 2 whites', 280, 25, 3, 19, 'weekly', false],
  ['lunch', 'base', 'Ponni rice', '1 cup cooked', 210, 4, 46, 1, 'pantry', true],
  ['lunch', 'protein', 'Chicken curry', '200 g raw breast', 300, 46, 4, 10, 'daily', true],
  ['lunch', 'protein', 'Fish curry', '200 g raw', 260, 40, 4, 9, 'daily', false],
  ['lunch', 'protein', 'Egg curry', '4 eggs', 340, 25, 6, 24, 'weekly', false],
  ['lunch', 'veg', 'Vegetable poriyal', '1 cup', 100, 3, 10, 5, 'weekly', true],
  ['lunch', 'veg', 'Kootu', '1 cup', 150, 7, 18, 5, 'weekly', false],
  ['lunch', 'dairy', 'Curd', '150 g', 90, 5, 7, 5, 'daily', true],
  ['snack', 'legume', 'Moong sprouts sundal', '1 cup', 150, 12, 22, 2, 'weekly', true],
  ['snack', 'legume', 'Channa sundal', '1 cup', 210, 11, 35, 3, 'weekly', false],
  ['snack', 'fruit', 'Banana', '1', 100, 1, 26, 0, 'daily', true],
  ['snack', 'fruit', 'Guava', '1', 70, 3, 14, 1, 'weekly', false],
  ['snack', 'nuts', 'Peanuts', '20 g', 115, 5, 3, 10, 'pantry', true],
  ['snack', 'nuts', 'Almonds', '20 g', 115, 4, 4, 10, 'pantry', false],
  ['snack', 'drink', 'Buttermilk', '1 glass', 40, 3, 4, 1, 'daily', true],
  ['dinner', 'base', 'Chapati', '2', 240, 7, 40, 6, 'pantry', true],
  ['dinner', 'base', 'Dosa', '2 pcs', 220, 5, 36, 6, 'daily', false],
  ['dinner', 'protein', 'Fish curry (small)', '150 g raw', 200, 30, 4, 7, 'daily', true],
  ['dinner', 'protein', 'Paneer curry', '100 g paneer', 290, 18, 5, 22, 'daily', false],
  ['dinner', 'protein', 'Egg curry', '3 eggs', 255, 19, 5, 18, 'weekly', false],
  ['dinner', 'veg', 'Cucumber-onion salad', '1 bowl', 40, 1, 8, 0, 'daily', true],
];

const TIMES: Record<string, string> = {
  breakfast: '07:00:00',
  lunch: '13:00:00',
  snack: '16:30:00',
  dinner: '20:00:00',
};
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-');

/** The seeded plan with readable ids: meal "m-lunch", dish "d-lunch-curd", item "i-lunch-curd". */
export function seedMealPlan(): MealPlanFull {
  const meals = Object.entries(TIMES).map(([slot, time], sort) => ({
    id: `m-${slot}`,
    client_id: `m-${slot}-c`,
    plan_id: 'plan',
    slot,
    time,
    sort,
    deleted_at: null,
  }));
  const dishes: MealPlanFull['dishes'] = [];
  const items: MealPlanFull['items'] = [];
  SEED.forEach(([slot, group, name, serving, kcal, p, c, f, , isDefault], i) => {
    const key = `${slot}-${slug(name)}`;
    dishes.push({
      id: `d-${key}`,
      client_id: `d-${key}-c`,
      name,
      serving_text: serving,
      kcal,
      protein_g: p,
      carbs_g: c,
      fat_g: f,
      deleted_at: null,
    });
    items.push({
      id: `i-${key}`,
      client_id: `i-${key}-c`,
      meal_id: `m-${slot}`,
      dish_id: `d-${key}`,
      swap_group: group,
      is_default: isDefault,
      sort: i,
      deleted_at: null,
    });
  });
  return { plan: { id: 'plan', client_id: 'plan-c', name: 'Fixed Day v1' }, meals, items, dishes };
}
