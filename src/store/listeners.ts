import { createListenerMiddleware } from '@reduxjs/toolkit';

import type { AuthState } from '@/features/auth/slice';
import { deleteAccount, ensureSeeded } from '@/features/auth/slice';
import { cancelAllReminders } from '@/features/notifications/os';
import { ownerDropped, runSync } from '@/features/sync/slice';

import { type AppState, accountCleared, accountSet } from './appSlice';
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

type AccountRoot = { app: AppState; auth: AuthState };
const accountOf = (s: AccountRoot) =>
  s.auth.status === 'signedIn' ? (s.auth.user?.id ?? null) : null;

/**
 * F25 · several people, one phone. When the signed-in account differs from the
 * one whose data is cached (or someone signs out), drop the cached data and the
 * scheduled reminders. Also runs after storage is restored, so cached data from
 * another account is never shown. A phone cached before F25 (no account yet)
 * keeps its cache for whoever is signed in.
 */
listenerMiddleware.startListening({
  predicate: (action, current, previous) => {
    const s = current as AccountRoot;
    const p = previous as AccountRoot;
    if (s.auth.status === 'restoring') return false;
    const signedOut = p.auth.status === 'signedIn' && s.auth.status === 'signedOut';
    const now = accountOf(s);
    return signedOut || (now !== null && (s.app.account ?? null) !== now);
  },
  effect: async (_, api) => {
    const s = api.getState() as AccountRoot;
    const now = accountOf(s);
    const cached = s.app.account ?? null;
    const clear = cached !== null || now === null;
    // Set first: the predicate must not match again while the reminders are cancelled.
    api.dispatch(accountSet(now));
    if (!clear) return;
    api.dispatch(baseApi.util.resetApiState());
    api.dispatch(accountCleared());
    await cancelAllReminders();
  },
});

// F25: a deleted account's unsent writes can never be pushed; drop them.
listenerMiddleware.startListening({
  actionCreator: deleteAccount.fulfilled,
  effect: (action, api) => {
    api.dispatch(ownerDropped(action.payload));
  },
});
