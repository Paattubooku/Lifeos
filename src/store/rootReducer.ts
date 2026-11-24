import { combineReducers } from '@reduxjs/toolkit';
import { persistReducer } from 'redux-persist';

import { authSlice } from '@/features/auth/slice';
import { foodSlice } from '@/features/food/slice';
import { notificationsSlice } from '@/features/notifications/slice';
import { stepsSlice } from '@/features/steps/slice';
import { trainSlice } from '@/features/train/slice';
import { profileSlice } from '@/features/profile/slice';
import { syncSlice } from '@/features/sync/slice';

import { appSlice } from './appSlice';
import { baseApi } from './baseApi';
import { syncPersistConfig } from './syncPersist';

/** Own module so `persist.ts` can type its config without importing the store (no type cycle). */
export const rootReducer = combineReducers({
  [appSlice.name]: appSlice.reducer,
  [authSlice.name]: authSlice.reducer,
  [syncSlice.name]: persistReducer(syncPersistConfig, syncSlice.reducer),
  [profileSlice.name]: profileSlice.reducer,
  [foodSlice.name]: foodSlice.reducer,
  [notificationsSlice.name]: notificationsSlice.reducer,
  [trainSlice.name]: trainSlice.reducer,
  [stepsSlice.name]: stepsSlice.reducer,
  [baseApi.reducerPath]: baseApi.reducer,
});

export type RootReducerState = ReturnType<typeof rootReducer>;
