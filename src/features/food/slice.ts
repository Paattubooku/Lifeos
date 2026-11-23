import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import type { DaySwaps } from './lib/plan';

/**
 * Today-only dish choices made before eating ("Today only" in the swap sheet).
 * Device-local and kept for one logical day; once eaten, the choice lives on
 * the food_log row instead.
 */
export type FoodState = { swapsDate: string | null; swaps: DaySwaps };

export const initialFoodState: FoodState = { swapsDate: null, swaps: {} };

export const foodSlice = createSlice({
  name: 'food',
  initialState: initialFoodState,
  reducers: {
    daySwapSet(
      state,
      {
        payload,
      }: PayloadAction<{ date: string; mealId: string; group: string; dishId: string | null }>,
    ) {
      if (state.swapsDate !== payload.date) {
        state.swapsDate = payload.date;
        state.swaps = {};
      }
      const meal = { ...(state.swaps[payload.mealId] ?? {}) };
      if (payload.dishId) meal[payload.group] = payload.dishId;
      else delete meal[payload.group];
      state.swaps[payload.mealId] = meal;
    },
  },
});

export const { daySwapSet } = foodSlice.actions;

/** Today's swaps (empty on any other day). */
export const selectDaySwaps = (s: { food: FoodState }, date: string): DaySwaps =>
  s.food.swapsDate === date ? s.food.swaps : EMPTY;
const EMPTY: DaySwaps = {};
