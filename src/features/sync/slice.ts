import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';

import type { AuthDeps, AuthState } from '@/features/auth/slice';
import { newClientId } from '@/lib/ids';
import {
  addRecent,
  classifyError,
  dueMutations,
  enqueue,
  type ErrorKind,
  markFailed,
  markSynced,
  type Mutation,
  type NewWrite,
  pruneRecent,
  resetNetworkBackoff,
  reviveDead,
  type Row,
  type SyncTable,
} from '@/lib/sync';

export type SyncState = {
  queue: Mutation[];
  /** Pushed writes still overlaying server data until the next read of their table. */
  recent: Mutation[];
  dead: Mutation[];
  lastSyncedAt: number | null;
  syncing: boolean;
  /** From NetInfo; null until the first reading. */
  online: boolean | null;
  lastError: string | null;
};

export const initialSyncState: SyncState = {
  queue: [],
  recent: [],
  dead: [],
  lastSyncedAt: null,
  syncing: false,
  online: null,
  lastError: null,
};

export type SyncRoot = { sync: SyncState; auth: AuthState };
type ThunkConfig = { extra: AuthDeps; state: SyncRoot; rejectValue: string };

const clock = (deps: AuthDeps) => deps.now?.() ?? Date.now();

/** The slice of the Supabase client the worker uses (tables are dynamic here). */
type LooseClient = {
  from(table: string): {
    upsert(row: Row, options: { onConflict: string }): PromiseLike<{ error: unknown }>;
    update(row: Row): { eq(column: string, value: string): PromiseLike<{ error: unknown }> };
  };
};

async function push(client: LooseClient, m: Mutation, now: number): Promise<unknown> {
  try {
    const table = client.from(m.table);
    const { error } =
      m.op === 'upsert'
        ? await table.upsert({ ...m.row, client_id: m.client_id }, { onConflict: 'client_id' })
        : await table
            .update({
              // When the user deleted it, not when it reached the server.
              deleted_at:
                typeof m.row.deleted_at === 'string'
                  ? m.row.deleted_at
                  : new Date(now).toISOString(),
            })
            .eq('client_id', m.client_id);
    return error ?? null;
  } catch (e) {
    return e ?? new Error('Unknown sync error');
  }
}

/**
 * Pushes due writes one by one, oldest first, until the queue is empty or the
 * network is gone. Runs only signed in, online and never twice at once.
 */
export const runSync = createAsyncThunk<
  { pushed: number; failed: number; at: number },
  void,
  ThunkConfig
>(
  'sync/run',
  async (_, { getState, dispatch, extra }) => {
    const owner = getState().auth.user?.id as string;
    const client = extra.getSupabase() as unknown as LooseClient;
    let pushed = 0;
    let failed = 0;
    for (let guard = 0; guard < 1000; guard++) {
      const next = dueMutations(getState().sync.queue, owner, clock(extra))[0];
      if (!next) break;
      const error = await push(client, next, clock(extra));
      if (!error) {
        dispatch(
          syncSlice.actions.pushed({ client_id: next.client_id, rev: next.rev, at: clock(extra) }),
        );
        pushed++;
        continue;
      }
      const kind = classifyError(error);
      const message =
        typeof (error as { message?: unknown }).message === 'string'
          ? (error as { message: string }).message
          : String(error);
      dispatch(
        syncSlice.actions.failed({
          client_id: next.client_id,
          rev: next.rev,
          kind,
          message,
          now: clock(extra),
        }),
      );
      failed++;
      if (kind === 'network') break;
    }
    return { pushed, failed, at: clock(extra) };
  },
  {
    condition: (_, { getState, extra }) => {
      const s = getState();
      return (
        extra.isConfigured &&
        !s.sync.syncing &&
        s.sync.online !== false &&
        s.auth.status === 'signedIn' &&
        !!s.auth.user
      );
    },
  },
);

/**
 * Optimistic upsert: queues the row and starts a push. Pass `clientId` to edit an
 * existing row; omit it to create one. Returns the row's client_id.
 */
export const queueUpsert = createAsyncThunk<
  string,
  { table: SyncTable; row: Row; clientId?: string },
  ThunkConfig
>(
  'sync/queueUpsert',
  async ({ table, row, clientId }, { getState, dispatch, extra, rejectWithValue }) => {
    const owner = getState().auth.user?.id;
    if (!owner) return rejectWithValue('Not signed in');
    const id = clientId ?? newClientId();
    dispatch(
      syncSlice.actions.enqueued({
        write: { client_id: id, table, op: 'upsert', row, owner, is_new: clientId === undefined },
        now: clock(extra),
      }),
    );
    void dispatch(runSync());
    return id;
  },
);

/** Optimistic soft delete. `isNew` = the row was created on this device and may not be synced. */
export const queueSoftDelete = createAsyncThunk<
  void,
  { table: SyncTable; clientId: string; isNew?: boolean },
  ThunkConfig
>(
  'sync/queueSoftDelete',
  async ({ table, clientId, isNew }, { getState, dispatch, extra, rejectWithValue }) => {
    const owner = getState().auth.user?.id;
    if (!owner) return rejectWithValue('Not signed in');
    const queued = getState().sync.queue.find((m) => m.client_id === clientId && m.table === table);
    dispatch(
      syncSlice.actions.enqueued({
        write: {
          client_id: clientId,
          table,
          op: 'soft_delete',
          row: { deleted_at: new Date(clock(extra)).toISOString() },
          owner,
          is_new: isNew ?? queued?.is_new ?? false,
        },
        now: clock(extra),
      }),
    );
    void dispatch(runSync());
  },
);

export const syncSlice = createSlice({
  name: 'sync',
  initialState: initialSyncState,
  reducers: {
    /** F25: the account was deleted — its unsent writes can never be pushed. */
    ownerDropped(state, { payload }: PayloadAction<string>) {
      state.queue = state.queue.filter((m) => m.owner !== payload);
      state.recent = (state.recent ?? []).filter((m) => m.owner !== payload);
      state.dead = state.dead.filter((m) => m.owner !== payload);
    },
    enqueued(state, { payload }: PayloadAction<{ write: NewWrite; now: number }>) {
      state.queue = enqueue(state.queue, payload.write, payload.now);
    },
    pushed(state, { payload }: PayloadAction<{ client_id: string; rev: number; at: number }>) {
      const m = state.queue.find((q) => q.client_id === payload.client_id && q.rev === payload.rev);
      state.queue = markSynced(state.queue, payload.client_id, payload.rev);
      if (m) state.recent = addRecent(state.recent ?? [], m, payload.at);
    },
    /** A server read of `table` started at `startedAt` — it already contains older pushes. */
    serverRead(state, { payload }: PayloadAction<{ table: SyncTable; startedAt: number }>) {
      state.recent = pruneRecent(state.recent ?? [], payload.table, payload.startedAt);
    },
    failed(
      state,
      {
        payload,
      }: PayloadAction<{
        client_id: string;
        rev: number;
        kind: ErrorKind;
        message: string;
        now: number;
      }>,
    ) {
      const r = markFailed(
        state.queue,
        state.dead,
        payload.client_id,
        payload.rev,
        payload,
        payload.now,
      );
      state.queue = r.queue;
      state.dead = r.dead;
      state.lastError = payload.message;
    },
    connectivityChanged(state, { payload }: PayloadAction<{ online: boolean; now: number }>) {
      const regained = payload.online && state.online === false;
      state.online = payload.online;
      if (regained) state.queue = resetNetworkBackoff(state.queue, payload.now);
    },
    retryDead(state, { payload }: PayloadAction<{ now: number }>) {
      state.queue = reviveDead(state.queue, state.dead, payload.now);
      state.dead = [];
      state.lastError = null;
    },
  },
  extraReducers: (b) => {
    b.addCase(runSync.pending, (state) => {
      state.syncing = true;
    });
    b.addCase(runSync.fulfilled, (state, { payload }) => {
      state.syncing = false;
      if (payload.failed === 0) {
        state.lastSyncedAt = payload.at;
        state.lastError = null;
      }
    });
    b.addCase(runSync.rejected, (state, { error }) => {
      state.syncing = false;
      state.lastError = error.message ?? 'Sync failed';
    });
  },
});

export const { connectivityChanged, retryDead, serverRead, ownerDropped } = syncSlice.actions;
