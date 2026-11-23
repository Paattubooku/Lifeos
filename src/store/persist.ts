import type { PersistConfig } from 'redux-persist';

import { storage } from '@/lib/storage';

import type { RootReducerState } from './rootReducer';

export const persistConfig: PersistConfig<RootReducerState> = {
  key: 'lifeos-root',
  version: 1,
  storage,
  // Wait for storage instead of redux-persist's 5 s give-up timer (see syncPersistConfig).
  timeout: 0,
  // UI prefs + the RTK Query cache (offline reads; restored via extractRehydrationInfo).
  whitelist: ['app', 'api', 'profile', 'food', 'notifications'],
};

export { syncPersistConfig } from './syncPersist';
