import type { PersistConfig } from 'redux-persist';

import { storage } from '@/lib/storage';

import type { RootReducerState } from './rootReducer';

export const persistConfig: PersistConfig<RootReducerState> = {
  key: 'lifeos-root',
  version: 1,
  storage,
  // Wait for storage instead of redux-persist's 5 s give-up timer (see syncPersistConfig).
  timeout: 0,
  // Write at most every 500 ms (cache + drafts), not on every key press. The write
  // queue has its own config with no throttle, so no change is ever lost.
  throttle: 500,
  // UI prefs + the RTK Query cache (offline reads; restored via extractRehydrationInfo).
  whitelist: ['app', 'api', 'profile', 'food', 'notifications', 'train', 'steps', 'accountability'],
};

export { syncPersistConfig } from './syncPersist';
