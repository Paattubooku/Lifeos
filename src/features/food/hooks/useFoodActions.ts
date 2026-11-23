import { useEffect, useRef } from 'react';

import type { Change } from '@/features/routine/lib/changes';
import { applyChanges } from '@/features/routine/slice';
import { queueSoftDelete, queueUpsert } from '@/features/sync/slice';
import { useAppDispatch } from '@/store';
import { haptics, useSnackbar } from '@/ui';

import { COFFEE_KCAL, coffeeState, type OffPlanInput, planOffPlan } from '../lib/extras';
import {
  planEatMeal,
  planMakeDefault,
  planPortion,
  planRestoreMeal,
  planSwapEaten,
  planToggleDish,
} from '../lib/logging';
import {
  type DishRow,
  type FoodLogRow,
  type GroupView,
  type MealView,
  type Portion,
  PORTIONS,
} from '../lib/plan';
import { daySwapSet } from '../slice';
import type { useFood } from './useFood';

type Food = Pick<ReturnType<typeof useFood>, 'today' | 'day' | 'plan'> &
  Partial<Pick<ReturnType<typeof useFood>, 'coffees' | 'coffeeLimit'>>;

/** Event-time clock (kept out of render for the React Compiler). */
const clock = () => Date.now();

/** Food tab / meal detail / Today actions, each with an Undo snackbar. */
export function useFoodActions(food: Food) {
  const dispatch = useAppDispatch();
  const showSnackbar = useSnackbar();
  const latest = useRef(food);
  useEffect(() => {
    latest.current = food;
  });

  const current = (mealId: string) =>
    latest.current.day.meals.find((m) => m.meal.id === mealId) ?? null;

  /** Apply meal changes; Undo puts the meal's logs back as they were. */
  const change = async (before: MealView, changes: Change[], message: string) => {
    if (changes.length === 0) return;
    haptics.tap();
    await dispatch(applyChanges(changes));
    showSnackbar({
      message,
      actionLabel: 'Undo',
      onAction: () => {
        const now = current(before.meal.id);
        if (now) void dispatch(applyChanges(planRestoreMeal(before, now)));
      },
    });
  };

  return {
    /** +1 coffee (logged even over the limit, with a warning). */
    addCoffee: async () => {
      const count = (latest.current.coffees?.length ?? 0) + 1;
      const limit = latest.current.coffeeLimit ?? 2;
      const res = await dispatch(
        queueUpsert({
          table: 'coffee_log',
          row: { date: food.today, logged_at: new Date(clock()).toISOString() },
        }),
      );
      const id = queueUpsert.fulfilled.match(res) ? res.payload : null;
      haptics.tap();
      const state = coffeeState(count, limit);
      showSnackbar({
        message:
          state === 'over'
            ? `Coffee ${count} of ${limit}. Over limit — still logged.`
            : state === 'at'
              ? `Coffee ${count} of ${limit}. That was the last one.`
              : `Coffee ${count} of ${limit} · ${COFFEE_KCAL} kcal`,
        ...(id
          ? {
              actionLabel: 'Undo',
              onAction: () => void dispatch(queueSoftDelete({ table: 'coffee_log', clientId: id })),
            }
          : {}),
      });
    },

    /** −1 coffee: removes the latest one today. */
    removeCoffee: async () => {
      const last = latest.current.coffees?.at(-1);
      if (!last) return;
      haptics.tap();
      await dispatch(queueSoftDelete({ table: 'coffee_log', clientId: last.client_id }));
      showSnackbar({
        message: 'One coffee removed',
        actionLabel: 'Undo',
        onAction: () =>
          void dispatch(
            queueUpsert({
              table: 'coffee_log',
              clientId: last.client_id,
              row: { date: last.date, logged_at: last.logged_at, deleted_at: null },
            }),
          ),
      });
    },

    addOffPlan: (input: OffPlanInput, meal: MealView | null) => {
      const changes = planOffPlan(input, { date: food.today, now: clock(), meal });
      if (meal) return change(meal, changes, `${input.kcal} kcal off-plan added to ${meal.name}`);
      haptics.tap();
      return dispatch(applyChanges(changes)).then(() =>
        showSnackbar({ message: `${input.kcal} kcal off-plan added` }),
      );
    },

    /** Delete an off-plan entry (Undo re-sends the full row). */
    removeOffPlan: async (log: FoodLogRow) => {
      await dispatch(queueSoftDelete({ table: 'food_log', clientId: log.client_id }));
      const { client_id, ...row } = log;
      showSnackbar({
        message: `${log.free_text ?? 'Entry'} removed`,
        actionLabel: 'Undo',
        onAction: () =>
          void dispatch(
            queueUpsert({
              table: 'food_log',
              clientId: client_id,
              row: { ...row, deleted_at: null },
            }),
          ),
      });
    },

    eatMeal: (view: MealView) =>
      change(view, planEatMeal(view, food.today, clock()), `${view.name} eaten as planned`),

    toggleDish: (view: MealView, g: GroupView) =>
      change(
        view,
        planToggleDish(view, g, food.today, clock()),
        g.log ? `${g.dish.name} unticked` : `${g.dish.name} ticked`,
      ),

    setPortion: (view: MealView, g: GroupView, portion: Portion) =>
      change(
        view,
        planPortion(view, g, portion, food.today, clock()),
        `${g.dish.name}: ${PORTIONS.find((p) => p.value === portion)?.label ?? ''}`.trim(),
      ),

    /** Swap a group's dish: rewrites the eaten log, or today's plan if not eaten; optionally the default. */
    swap: async (view: MealView, g: GroupView, to: DishRow, makeDefault: boolean) => {
      if (g.log) {
        await change(
          view,
          planSwapEaten(view, g, to, food.today, clock()),
          `Swapped to ${to.name}`,
        );
      } else {
        haptics.tap();
        dispatch(
          daySwapSet({ date: food.today, mealId: view.meal.id, group: g.group, dishId: to.id }),
        );
        if (!makeDefault)
          showSnackbar({
            message: `Today: ${to.name}`,
            actionLabel: 'Undo',
            onAction: () =>
              dispatch(
                daySwapSet({
                  date: food.today,
                  mealId: view.meal.id,
                  group: g.group,
                  dishId: null,
                }),
              ),
          });
      }
      if (makeDefault) {
        dispatch(
          daySwapSet({ date: food.today, mealId: view.meal.id, group: g.group, dishId: null }),
        );
        const before = latest.current.plan.items.filter(
          (i) => i.meal_id === view.meal.id && i.swap_group === g.group,
        );
        await dispatch(
          applyChanges(planMakeDefault(latest.current.plan.items, view.meal.id, g.group, to.id)),
        );
        showSnackbar({
          message: `${to.name} is the new default`,
          actionLabel: 'Undo',
          onAction: () => {
            const old = before.find((i) => i.is_default);
            if (old)
              void dispatch(
                applyChanges(
                  planMakeDefault(latest.current.plan.items, view.meal.id, g.group, old.dish_id),
                ),
              );
          },
        });
      }
    },
  };
}
