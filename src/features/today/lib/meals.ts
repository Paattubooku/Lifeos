import type { MealSlot } from '@/features/routine/lib/blocks';

export type MealPlanLike = {
  meals: readonly { id: string; slot: string }[];
  items: readonly { meal_id: string; dish_id: string; is_default: boolean; sort: number }[];
  dishes: readonly { id: string; name: string; kcal: number; protein_g: number | string }[];
};

export type FoodLike = {
  meal_id: string | null;
  dish_id: string | null;
  free_text?: string | null;
  portion: number | string;
  kcal: number;
  protein_g: number | string;
};

/** Slots with something eaten (portion > 0) — meal blocks auto-complete from these. */
export function eatenSlots(food: readonly FoodLike[], plan: MealPlanLike): Set<string> {
  const slotOf = new Map(plan.meals.map((m) => [m.id, m.slot]));
  const out = new Set<string>();
  for (const f of food) {
    const slot = f.meal_id ? slotOf.get(f.meal_id) : undefined;
    if (slot && Number(f.portion) > 0) out.add(slot);
  }
  return out;
}

export type MealSummary = { names: string[]; kcal: number; protein: number; eaten: boolean };

/**
 * What a meal block shows: what was eaten in the slot if anything, otherwise
 * the plan's default dishes (DESIGN_NOTES B4: every number from `dish`).
 */
export function mealSummary(
  slot: MealSlot | string | null,
  food: readonly FoodLike[],
  plan: MealPlanLike,
): MealSummary | null {
  if (!slot) return null;
  const meal = plan.meals.find((m) => m.slot === slot);
  const dishById = new Map(plan.dishes.map((d) => [d.id, d]));
  const eaten = meal ? food.filter((f) => f.meal_id === meal.id && Number(f.portion) > 0) : [];
  if (eaten.length > 0) {
    return {
      names: eaten.map((f) => (f.dish_id ? dishById.get(f.dish_id)?.name : f.free_text) ?? 'Food'),
      kcal: eaten.reduce((s, f) => s + f.kcal, 0),
      protein: Math.round(eaten.reduce((s, f) => s + Number(f.protein_g), 0)),
      eaten: true,
    };
  }
  if (!meal) return null;
  const dishes = plan.items
    .filter((i) => i.meal_id === meal.id && i.is_default)
    .sort((a, b) => a.sort - b.sort)
    .map((i) => dishById.get(i.dish_id))
    .filter((d): d is NonNullable<typeof d> => Boolean(d));
  if (dishes.length === 0) return null;
  return {
    names: dishes.map((d) => d.name),
    kcal: dishes.reduce((s, d) => s + d.kcal, 0),
    protein: Math.round(dishes.reduce((s, d) => s + Number(d.protein_g), 0)),
    eaten: false,
  };
}

/** Food totals for the ring's sub-stats. */
export function foodTotals(food: readonly FoodLike[]) {
  return {
    kcal: food.reduce((s, f) => s + f.kcal, 0),
    protein: Math.round(food.reduce((s, f) => s + Number(f.protein_g), 0)),
  };
}
