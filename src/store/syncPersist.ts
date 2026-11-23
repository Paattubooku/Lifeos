import type { PersistConfig } from 'redux-persist';

import type { SyncState } from '@/features/sync/slice';
import { storage } from '@/lib/storage';

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
  whitelist: ['queue', 'recent', 'dead', 'lastSyncedAt'],
};
