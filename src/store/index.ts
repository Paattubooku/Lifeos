import { combineReducers, configureStore } from '@reduxjs/toolkit';
import { type TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';
import { FLUSH, PAUSE, PERSIST, PURGE, REGISTER, REHYDRATE, persistReducer } from 'redux-persist';

import { type AuthDeps, authSlice } from '@/features/auth/slice';
import { syncSlice } from '@/features/sync/slice';
import { AUTH_STORAGE_KEY, authStorage, getSupabase, isSupabaseConfigured } from '@/lib/supabase';

import { appSlice } from './appSlice';
import { baseApi } from './baseApi';
import { persistConfig, syncPersistConfig } from './persist';

const rootReducer = combineReducers({
  [appSlice.name]: appSlice.reducer,
  [authSlice.name]: authSlice.reducer,
  [syncSlice.name]: persistReducer(syncPersistConfig, syncSlice.reducer),
  [baseApi.reducerPath]: baseApi.reducer,
});

export type RootReducerState = ReturnType<typeof rootReducer>;

export const defaultDeps: AuthDeps = {
  getSupabase,
  isConfigured: isSupabaseConfigured,
  authStorage,
  storageKey: AUTH_STORAGE_KEY,
};

/** `deps` is the thunk extra argument (tests pass a fake Supabase client). */
export function makeStore(deps: AuthDeps = defaultDeps) {
  return configureStore({
    reducer: persistReducer(persistConfig, rootReducer),
    middleware: (getDefault) =>
      getDefault({
        thunk: { extraArgument: deps },
        serializableCheck: { ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER] },
      }).concat(baseApi.middleware),
  });
}

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = RootReducerState;
export type AppDispatch = AppStore['dispatch'];

export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
