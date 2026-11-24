import { configureStore, type Reducer, type UnknownAction } from '@reduxjs/toolkit';
import { type TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';
import { FLUSH, PAUSE, PERSIST, PURGE, REGISTER, REHYDRATE, persistReducer } from 'redux-persist';

import type { AuthDeps } from '@/features/auth/slice';
import { AUTH_STORAGE_KEY, authStorage, getSupabase, isSupabaseConfigured } from '@/lib/supabase';

import { baseApi } from './baseApi';
import { listenerMiddleware } from './listeners';
import { persistConfig } from './persist';
import { rootReducer, type RootReducerState } from './rootReducer';

export type { RootReducerState };

export const defaultDeps: AuthDeps = {
  getSupabase,
  isConfigured: isSupabaseConfigured,
  authStorage,
  storageKey: AUTH_STORAGE_KEY,
};

const persistedReducer = persistReducer(persistConfig, rootReducer);
const RUN_INVARIANT_CHECKS = process.env.JEST_WORKER_ID !== undefined;
// Explicit type: with redux-persist's reducer plus a thunk extra argument, RTK infers state as `any`.
const reducer: Reducer<ReturnType<typeof persistedReducer>, UnknownAction> = persistedReducer;

/** `deps` is the thunk extra argument (tests pass a fake Supabase client). */
export function makeStore(deps: AuthDeps = defaultDeps) {
  return configureStore({
    reducer,
    middleware: (getDefault) =>
      getDefault({
        thunk: { extraArgument: deps },
        // Dev-only invariant checks walk the whole (large, persisted) state on every
        // action: ~40 ms per key press on a phone. Kept in tests, off in the app.
        immutableCheck: RUN_INVARIANT_CHECKS,
        serializableCheck: RUN_INVARIANT_CHECKS
          ? { ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER] }
          : false,
      })
        .prepend(listenerMiddleware.middleware)
        .concat(baseApi.middleware),
  });
}

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = RootReducerState;
export type AppDispatch = AppStore['dispatch'];

export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
