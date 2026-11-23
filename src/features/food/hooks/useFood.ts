import { useMemo } from 'react';

import { useLocalWrites, useProfile } from '@/features/profile/hooks/useProfileData';
import { dayMinutes, hhmm } from '@/features/routine/lib/blocks';
import { useGetFoodLogsQuery } from '@/features/today/api';
import { live, mergeKeepingDeleted } from '@/features/today/lib/merge';
import { nowDayMinutes } from '@/features/today/lib/timeline';
import { logicalDate } from '@/lib/dates';
import { useAppSelector } from '@/store';

import { useGetCoffeeLogsQuery, useGetMealPlanQuery } from '../api';
import { COFFEE_KCAL } from '../lib/extras';
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
  const coffeeQ = useGetCoffeeLogsQuery(today);
  const coffeeWrites = useLocalWrites('coffee_log');
  const coffees = useMemo(
    () =>
      live(mergeKeepingDeleted(coffeeQ.data ?? [], coffeeWrites))
        .filter((c) => c.date === today)
        .sort((a, b) => String(a.logged_at).localeCompare(String(b.logged_at))),
    [coffeeQ.data, coffeeWrites, today],
  );
  // Coffee adds 20 kcal each on top of food (PRD §6.3; v_daily_summary.kcal is food only).
  const day = useMemo(() => {
    const d = dayFood(plan, logs, swaps, nowMin);
    const extra = coffees.length * COFFEE_KCAL;
    return {
      ...d,
      eaten: { ...d.eaten, kcal: d.eaten.kcal + extra },
      projected: { ...d.projected, kcal: d.projected.kcal + extra },
    };
  }, [plan, logs, swaps, nowMin, coffees.length]);

  const kcalTarget = profile?.kcal_target ?? 2200;
  const coffeeLimit = profile?.coffee_limit ?? 2;
  const proteinTarget = profile?.protein_target_g ?? 150;
  const dinner = plan.meals.find((m) => m.slot === 'dinner');
  const chips = topInsights({
    ...day.eaten,
    kcalTarget,
    proteinTarget,
    nowMin,
    dinnerMin: dinner ? dayMinutes(hhmm(dinner.time)) : 20 * 60,
  });

  return {
    today,
    nowMin,
    plan,
    logs,
    swaps,
    day,
    coffees,
    coffeeLimit,
    kcalTarget,
    proteinTarget,
    chips,
    isLoading,
  };
}
