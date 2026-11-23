import type { Change } from '@/features/routine/lib/changes';
import type { DateString } from '@/lib/dates';

import { planPortion } from './logging';
import type { MealView } from './plan';

/** PTR's coffee: black, half sugar (PRD §6.3, DESIGN_NOTES B3). */
export const COFFEE_KCAL = 20;
export const COFFEE_PROTEIN_G = 0;

export type CoffeeState = 'under' | 'at' | 'over';

export function coffeeState(count: number, limit: number): CoffeeState {
  if (count > limit) return 'over';
  if (count === limit) return 'at';
  return 'under';
}

/** "1 of 2. One left today." / "2 of 2. That was the last one." / "3 of 2. Over by 1." */
export function coffeeLine(count: number, limit: number): string {
  const s = coffeeState(count, limit);
  if (s === 'over') return `${count} of ${limit}. Over by ${count - limit}.`;
  if (s === 'at')
    return count === 0 ? 'No coffee today.' : `${count} of ${limit}. That was the last one.`;
  const left = limit - count;
  return `${count} of ${limit}. ${left === 1 ? 'One' : String(left)} left today.`;
}

export function planCoffee(date: DateString, now: number): Change[] {
  return [
    { op: 'upsert', table: 'coffee_log', row: { date, logged_at: new Date(now).toISOString() } },
  ];
}

export type OffPlanInput = {
  text: string;
  kcal: number;
  protein: number | null;
  /** Meal id, or null for "Other". */
  mealId: string | null;
  /** Mark the planned dishes of that meal as not eaten (portion 0). */
  replaces: boolean;
};

export const OFF_PLAN_CHIPS = [100, 250, 500] as const;

export function validateOffPlan(i: Pick<OffPlanInput, 'text' | 'kcal' | 'protein'>): string | null {
  if (i.text.trim().length === 0) return 'Say what you ate.';
  if (i.text.trim().length > 80) return 'Keep it under 80 characters.';
  if (!Number.isInteger(i.kcal) || i.kcal < 1 || i.kcal > 5000) return 'Calories are 1–5,000.';
  if (i.protein !== null && (!Number.isFinite(i.protein) || i.protein < 0 || i.protein > 999))
    return 'Protein is 0–999 g.';
  return null;
}

/**
 * An off-plan food_log (free text, no dish). "Replaces planned …" also logs the
 * meal's not-yet-logged dishes at portion 0, so the plan stops counting them.
 */
export function planOffPlan(
  input: OffPlanInput,
  ctx: { date: DateString; now: number; meal: MealView | null },
): Change[] {
  const changes: Change[] = [
    {
      op: 'upsert',
      table: 'food_log',
      row: {
        date: ctx.date,
        meal_id: input.mealId,
        dish_id: null,
        swap_group: null,
        free_text: input.text.trim(),
        portion: 1,
        kcal: input.kcal,
        protein_g: input.protein ?? 0,
        is_off_plan: true,
        logged_at: new Date(ctx.now).toISOString(),
        deleted_at: null,
      },
    },
  ];
  if (input.replaces && ctx.meal) {
    for (const g of ctx.meal.groups)
      if (!g.log) changes.push(...planPortion(ctx.meal, g, 0, ctx.date, ctx.now));
  }
  return changes;
}
