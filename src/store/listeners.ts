import { createListenerMiddleware } from '@reduxjs/toolkit';

import { ensureSeeded } from '@/features/auth/slice';
import { runSync } from '@/features/sync/slice';

import { baseApi, TAGS } from './baseApi';

/** Cross-feature reactions that don't belong to one slice. */
export const listenerMiddleware = createListenerMiddleware();

// The default data was just created on the server → read it.
listenerMiddleware.startListening({
  actionCreator: ensureSeeded.fulfilled,
  effect: (_, api) => {
    api.dispatch(baseApi.util.invalidateTags([...TAGS]));
  },
});

// Writes reached the server → refresh the cached reads (the overlay covers the gap).
listenerMiddleware.startListening({
  actionCreator: runSync.fulfilled,
  effect: (action, api) => {
    if (action.payload.pushed > 0) api.dispatch(baseApi.util.invalidateTags([...TAGS]));
  },
});
