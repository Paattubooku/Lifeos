import type { PersistConfig } from 'redux-persist';

import { storage } from '@/lib/storage';

import type { RootReducerState } from './index';

export const persistConfig: PersistConfig<RootReducerState> = {
  key: 'lifeos-root',
  version: 1,
  storage,
  // Only local slices are persisted; RTK Query cache is rebuilt from the server.
  whitelist: ['app'],
};
