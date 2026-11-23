import type { Change } from '@/features/routine/lib/changes';
import type { DateString } from '@/lib/dates';

import {
  type DishRow,
  type GroupView,
  type ItemRow,
  type MealView,
  type Portion,
  scaled,
} from './plan';

const iso = (now: number) => new Date(now).toISOString();

/** One food_log row for a dish of a meal at a portion (kcal/protein stored, so later edits don't rewrite the past). */
function logRow(
  date: DateString,
  mealId: string,
  group: string,
  dish: DishRow,
  portion: number,
  now: number,
) {
  const s = scaled(dish, portion);
  return {
    date,
    meal_id: mealId,
    dish_id: dish.id,
    swap_group: group,
    free_text: null,
    portion,
    kcal: s.kcal,
    protein_g: s.protein,
    is_off_plan: false,
    logged_at: iso(now),
    deleted_at: null,
  };
}

/** "Eaten as planned": one food_log per swap group, full portion, the dish now shown. */
export function planEatMeal(view: MealView, date: DateString, now: number): Change[] {
  return view.groups.map((g) => ({
    op: 'upsert' as const,
    table: 'food_log' as const,
    ...(g.log ? { clientId: g.log.client_id } : {}),
    row: logRow(date, view.meal.id, g.group, g.dish, 1, now),
  }));
}

/** Un-tick a whole meal (Undo of "Eaten as planned"). */
export function planUneatMeal(view: MealView): Change[] {
  return view.groups.flatMap((g) =>
    g.log ? [{ op: 'delete' as const, table: 'food_log' as const, clientId: g.log.client_id }] : [],
  );
}

/** Tick one dish (full portion) or un-tick it (removes its log). */
export function planToggleDish(
  view: MealView,
  g: GroupView,
  date: DateString,
  now: number,
): Change[] {
  if (g.log) return [{ op: 'delete', table: 'food_log', clientId: g.log.client_id }];
  return [
    { op: 'upsert', table: 'food_log', row: logRow(date, view.meal.id, g.group, g.dish, 1, now) },
  ];
}

/**
 * Portion picker All / ¾ / ½ / None (A11). kcal and protein scale by the
 * portion; "None" keeps a 0-portion row ("skipped this dish").
 */
export function planPortion(
  view: MealView,
  g: GroupView,
  portion: Portion,
  date: DateString,
  now: number,
): Change[] {
  return [
    {
      op: 'upsert',
      table: 'food_log',
      ...(g.log ? { clientId: g.log.client_id } : {}),
      row: logRow(
        date,
        view.meal.id,
        g.group,
        g.dish,
        portion,
        g.log ? Date.parse(g.log.logged_at) || now : now,
      ),
    },
  ];
}

/** Swapping an eaten dish rewrites its log row with the new dish (same portion). */
export function planSwapEaten(
  view: MealView,
  g: GroupView,
  to: DishRow,
  date: DateString,
  now: number,
): Change[] {
  if (!g.log) return [];
  return [
    {
      op: 'upsert',
      table: 'food_log',
      clientId: g.log.client_id,
      row: logRow(date, view.meal.id, g.group, to, g.portion, Date.parse(g.log.logged_at) || now),
    },
  ];
}

/**
 * "Make this the default" for a swap group: clear the old default first
 * (one default per group is a unique index), then set the new one.
 */
export function planMakeDefault(
  items: readonly ItemRow[],
  mealId: string,
  group: string,
  dishId: string,
): Change[] {
  const inGroup = items.filter(
    (i) => !i.deleted_at && i.meal_id === mealId && i.swap_group === group,
  );
  const next = inGroup.find((i) => i.dish_id === dishId);
  if (!next || next.is_default) return [];
  return [
    ...inGroup
      .filter((i) => i.is_default)
      .map((i): Change => ({
        op: 'upsert',
        table: 'meal_item',
        clientId: i.client_id,
        row: { is_default: false },
      })),
    { op: 'upsert', table: 'meal_item', clientId: next.client_id, row: { is_default: true } },
  ];
}

/** Swap sheet deltas: "+90 kcal", "±0 g", "−1 g". */
export function signed(n: number, unit: string): string {
  const r = Math.round(n);
  if (r === 0) return `±0${unit}`;
  return `${r > 0 ? '+' : '−'}${Math.abs(r)}${unit}`;
}

/**
 * Undo for any meal change: put each swap group's log back exactly as it was
 * before (restore the old row, or remove one that didn't exist).
 */
export function planRestoreMeal(before: MealView, current: MealView): Change[] {
  const changes: Change[] = [];
  const groups = new Set([
    ...before.groups.map((g) => g.group),
    ...current.groups.map((g) => g.group),
  ]);
  for (const group of groups) {
    const was = before.groups.find((g) => g.group === group)?.log ?? null;
    const now = current.groups.find((g) => g.group === group)?.log ?? null;
    if (was) {
      const { client_id, ...row } = was;
      if (JSON.stringify(was) !== JSON.stringify(now))
        changes.push({
          op: 'upsert',
          table: 'food_log',
          clientId: client_id,
          row: { ...row, deleted_at: null },
        });
    } else if (now) {
      changes.push({ op: 'delete', table: 'food_log', clientId: now.client_id });
    }
  }
  return changes;
}
