import { baseApi } from '@/store/baseApi';
import { supabaseQuery, unwrapList, unwrapOne } from '@/store/supabaseQuery';

import type { Tables } from '@/types/supabase';

import type { MealPlanFull } from './lib/plan';

export const foodApi = baseApi.injectEndpoints({
  endpoints: (b) => ({
    /** The active plan with its meals and items, and every dish (the library). */
    getMealPlan: b.query<MealPlanFull, void>({
      queryFn: (_arg, api) =>
        supabaseQuery(api, ['meal_plan', 'meal', 'meal_item', 'dish'], async (c) => {
          const plan = unwrapOne(
            await c
              .from('meal_plan')
              .select('id, client_id, name')
              .eq('is_active', true)
              .is('deleted_at', null)
              .limit(1)
              .maybeSingle(),
          );
          const dishes = unwrapList(
            await c.from('dish').select('*').is('deleted_at', null).order('name'),
          );
          if (!plan) return { plan: null, meals: [], items: [], dishes };
          const meals = unwrapList(
            await c.from('meal').select('*').eq('plan_id', plan.id).is('deleted_at', null),
          );
          const items = unwrapList(await c.from('meal_item').select('*').is('deleted_at', null));
          const mealIds = new Set(meals.map((m) => m.id));
          return { plan, meals, items: items.filter((i) => mealIds.has(i.meal_id)), dishes };
        }),
      providesTags: ['MealPlan'],
    }),
    getCoffeeLogs: b.query<Tables<'coffee_log'>[], string>({
      queryFn: (date, api) =>
        supabaseQuery(api, ['coffee_log'], async (c) =>
          unwrapList(
            await c
              .from('coffee_log')
              .select('*')
              .eq('date', date)
              .is('deleted_at', null)
              .order('logged_at'),
          ),
        ),
      providesTags: ['Food'],
    }),
  }),
});

export const { useGetMealPlanQuery, useGetCoffeeLogsQuery } = foodApi;
