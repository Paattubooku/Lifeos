import { createSelector } from '@reduxjs/toolkit';

import { mergeByClientId, type Mutation, pendingFor, type SyncTable } from '@/lib/sync';

import type { SyncState } from './slice';

type Root = { sync: SyncState; auth: { user: { id: string } | null } };

const selectQueue = (s: Root) => s.sync.queue;
const selectDead = (s: Root) => s.sync.dead;
const selectOwner = (s: Root) => s.auth.user?.id ?? null;

/** This user's writes not yet on the server. */
export const selectPendingCount = createSelector([selectQueue, selectOwner], (queue, owner) =>
  owner ? queue.filter((m) => m.owner === owner).length : 0,
);

export const selectDeadCount = createSelector([selectDead, selectOwner], (dead, owner) =>
  owner ? dead.filter((m) => m.owner === owner).length : 0,
);

export type SyncStatus = 'issue' | 'offline' | 'syncing' | 'pending' | 'synced' | 'never';

export type SyncSummary = {
  status: SyncStatus;
  pending: number;
  dead: number;
  lastSyncedAt: number | null;
  lastError: string | null;
};

export const selectSyncSummary = createSelector(
  [
    selectPendingCount,
    selectDeadCount,
    (s: Root) => s.sync.online,
    (s: Root) => s.sync.syncing,
    (s: Root) => s.sync.lastSyncedAt,
    (s: Root) => s.sync.lastError,
  ],
  (pending, dead, online, syncing, lastSyncedAt, lastError): SyncSummary => {
    const status: SyncStatus =
      dead > 0
        ? 'issue'
        : online === false
          ? 'offline'
          : syncing
            ? 'syncing'
            : pending > 0
              ? 'pending'
              : lastSyncedAt
                ? 'synced'
                : 'never';
    return { status, pending, dead, lastSyncedAt, lastError };
  },
);

/**
 * This device's not-yet-confirmed writes for `table`: recently pushed ones
 * (until the next server read) followed by pending ones, so pending wins.
 */
export const makeSelectLocalWrites = (table: SyncTable) =>
  createSelector(
    [selectQueue, (s: Root) => s.sync.recent ?? [], selectOwner],
    (queue, recent, owner): Mutation[] =>
      owner ? [...pendingFor(recent, table, owner), ...pendingFor(queue, table, owner)] : [],
  );

/** Pending writes for one table (for merging into server reads). */
export const makeSelectPending = (table: SyncTable) =>
  createSelector([selectQueue, selectOwner], (queue, owner): Mutation[] =>
    pendingFor(queue, table, owner),
  );

/**
 * Server rows + this device's unsynced writes for `table`, merged by client_id
 * (PRD §3.2). Features pass their RTK Query rows in.
 */
export function mergeWithPending<T extends { client_id: string; deleted_at?: string | null }>(
  serverRows: readonly T[],
  pending: readonly Mutation[],
): T[] {
  return mergeByClientId(serverRows, pending);
}

/** "just now", "2 min ago", "3 h ago", "2 days ago". */
export function formatSyncedAgo(at: number, now: number): string {
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? '1 day ago' : `${d} days ago`;
}
