import type { PersistConfig } from 'redux-persist';

import type { SyncState } from '@/features/sync/slice';

import { storage } from '@/lib/storage';

import type { RootReducerState } from './index';

export const persistConfig: PersistConfig<RootReducerState> = {
  key: 'lifeos-root',
  version: 1,
  storage,
  // Wait for storage instead of redux-persist's 5 s give-up timer (see syncPersistConfig).
  timeout: 0,
  // Only local slices are persisted; RTK Query cache is rebuilt from the server.
  whitelist: ['app'],
};

/**
 * The write queue has its own key so it is saved independently of UI prefs.
 * Only durable fields are kept; `syncing` / `online` are runtime state.
 */
export const syncPersistConfig: PersistConfig<SyncState> = {
  key: 'lifeos-sync',
  version: 1,
  storage,
  // No give-up timer: on timeout redux-persist starts empty and the next save would
  // overwrite the stored queue — losing offline writes (PRD §9: zero lost writes).
  timeout: 0,
  whitelist: ['queue', 'dead', 'lastSyncedAt'],
};
