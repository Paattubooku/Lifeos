import { combineReducers, type UnknownAction } from '@reduxjs/toolkit';
import { persistReducer } from 'redux-persist';

import { authSlice } from '@/features/auth/slice';
import { foodSlice } from '@/features/food/slice';
import { notificationsSlice } from '@/features/notifications/slice';
import { accountabilitySlice } from '@/features/accountability/slice';
import { stepsSlice } from '@/features/steps/slice';
import { trainSlice } from '@/features/train/slice';
import { profileSlice } from '@/features/profile/slice';
import { syncSlice } from '@/features/sync/slice';

import { accountCleared, appSlice } from './appSlice';
import { baseApi } from './baseApi';
import { syncPersistConfig } from './syncPersist';

const combined = combineReducers({
  [appSlice.name]: appSlice.reducer,
  [authSlice.name]: authSlice.reducer,
  [syncSlice.name]: persistReducer(syncPersistConfig, syncSlice.reducer),
  [profileSlice.name]: profileSlice.reducer,
  [foodSlice.name]: foodSlice.reducer,
  [notificationsSlice.name]: notificationsSlice.reducer,
  [trainSlice.name]: trainSlice.reducer,
  [stepsSlice.name]: stepsSlice.reducer,
  [accountabilitySlice.name]: accountabilitySlice.reducer,
  [baseApi.reducerPath]: baseApi.reducer,
});

export type RootReducerState = ReturnType<typeof combined>;

/** Per-account state, reset to its initial value when another account takes over (F25). */
export const ACCOUNT_SCOPED = [
  profileSlice.name,
  foodSlice.name,
  notificationsSlice.name,
  trainSlice.name,
  stepsSlice.name,
  accountabilitySlice.name,
  baseApi.reducerPath,
] as const;

/** Own module so `persist.ts` can type its config without importing the store (no type cycle). */
export function rootReducer(
  state: RootReducerState | undefined,
  action: UnknownAction,
): RootReducerState {
  if (state && accountCleared.match(action)) {
    const kept: Partial<RootReducerState> = { ...state };
    for (const key of ACCOUNT_SCOPED) delete kept[key];
    return combined(kept as RootReducerState, action);
  }
  return combined(state, action);
}
