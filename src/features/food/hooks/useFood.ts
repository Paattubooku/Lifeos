import { useMemo } from 'react';

import { useLocalWrites, useProfile } from '@/features/profile/hooks/useProfileData';
import { dayMinutes, hhmm } from '@/features/routine/lib/blocks';
import { useGetFoodLogsQuery } from '@/features/today/api';
import { live, mergeKeepingDeleted } from '@/features/today/lib/merge';
import { nowDayMinutes } from '@/features/today/lib/timeline';
import { logicalDate } from '@/lib/dates';
import { useAppSelector } from '@/store';

import { useGetMealPlanQuery } from '../api';
import { topInsights } from '../lib/insights';
import { dayFood, type FoodLogRow, type MealPlanFull } from '../lib/plan';
import { selectDaySwaps } from '../slice';

const EMPTY: MealPlanFull = { plan: null, meals: [], items: [], dishes: [] };

/** The active plan with this phone's unsynced plan edits applied. */
export function useMealPlan() {
  const q = useGetMealPlanQuery();
  const mealWrites = useLocalWrites('meal');
  const itemWrites = useLocalWrites('meal_item');
  const dishWrites = useLocalWrites('dish');
  const plan = useMemo<MealPlanFull>(() => {
    const d = q.data ?? EMPTY;
    const meals = live(mergeKeepingDeleted(d.meals, mealWrites));
    const mealIds = new Set(meals.map((m) => m.id));
    return {
      plan: d.plan,
      meals,
      items: live(mergeKeepingDeleted(d.items, itemWrites)).filter((i) => mealIds.has(i.meal_id)),
      dishes: live(mergeKeepingDeleted(d.dishes, dishWrites)),
    };
  }, [q.data, mealWrites, itemWrites, dishWrites]);
  return { plan, isLoading: q.isLoading };
}

/** Everything the Food tab shows for the logical day containing `now`. */
export function useFood(now: number) {
  const today = logicalDate(now);
  const nowMin = nowDayMinutes(now);
  const { profile } = useProfile();
  const { plan, isLoading } = useMealPlan();
  const logsQ = useGetFoodLogsQuery(today);
  const writes = useLocalWrites('food_log');
  const swaps = useAppSelector((s) => selectDaySwaps(s, today));

  const logs = useMemo(
    () =>
      live(mergeKeepingDeleted<FoodLogRow>(logsQ.data ?? [], writes)).filter(
        (l) => l.date === today,
      ),
    [logsQ.data, writes, today],
  );
  const day = useMemo(() => dayFood(plan, logs, swaps, nowMin), [plan, logs, swaps, nowMin]);

  const kcalTarget = profile?.kcal_target ?? 2200;
  const proteinTarget = profile?.protein_target_g ?? 150;
  const dinner = plan.meals.find((m) => m.slot === 'dinner');
  const chips = topInsights({
    ...day.eaten,
    kcalTarget,
    proteinTarget,
    nowMin,
    dinnerMin: dinner ? dayMinutes(hhmm(dinner.time)) : 20 * 60,
  });

  return { today, nowMin, plan, logs, swaps, day, kcalTarget, proteinTarget, chips, isLoading };
}
