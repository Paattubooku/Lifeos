/**
 * Offline write queue (PRD §3.2, F02) — pure logic, no I/O.
 *
 * Every write lands here first (optimistic), keyed by the row's client_id, and
 * the worker (features/sync) pushes it to Supabase with an upsert on client_id,
 * so retries are idempotent. Everything here is a pure function of its inputs so
 * the rules (collapse, backoff, dead-letter, merge) are unit-tested in isolation.
 */
import type { Database } from '@/types/supabase';

export type SyncTable = keyof Database['public']['Tables'];
export type SyncOp = 'upsert' | 'soft_delete';
export type Row = Record<string, unknown>;

export type Mutation = {
  client_id: string;
  table: SyncTable;
  op: SyncOp;
  /** Row fields to upsert (client_id is added on push; user_id comes from the session). */
  row: Row;
  /** Auth user who made the change — only their session ever pushes it. */
  owner: string;
  /** Row was created on this device and has never reached the server. */
  is_new: boolean;
  attempts: number;
  next_try_at: number;
  enqueued_at: number;
  /** Bumped when a newer edit collapses into this entry (guards in-flight pushes). */
  rev: number;
  last_error?: string;
  last_error_kind?: ErrorKind;
};

export type ErrorKind = 'network' | 'retry' | 'permanent';

/** 1 s, 5 s, 30 s, 2 min, 10 min, then every 10 min (PRD F02). */
export const BACKOFF_MS = [1_000, 5_000, 30_000, 120_000, 600_000] as const;
export const MAX_BACKOFF_MS = 600_000;
export const DEAD_LETTER_AFTER = 20;

/** Delay before the next try after `attempts` failures (attempts ≥ 1). */
export function backoffDelay(attempts: number): number {
  if (attempts < 1) return 0;
  return BACKOFF_MS[attempts - 1] ?? MAX_BACKOFF_MS;
}

export type NewWrite = {
  client_id: string;
  table: SyncTable;
  op: SyncOp;
  row: Row;
  owner: string;
  is_new: boolean;
};

/**
 * Adds a write, collapsing with any queued write for the same client_id:
 *  - upsert after upsert → one upsert with the merged (latest-wins) row;
 *  - soft delete of a row that never reached the server → both dropped;
 *  - soft delete of a synced row → replaces the pending edit.
 */
export function enqueue(queue: readonly Mutation[], write: NewWrite, now: number): Mutation[] {
  const i = queue.findIndex((m) => m.client_id === write.client_id && m.table === write.table);
  const fresh: Mutation = {
    ...write,
    attempts: 0,
    next_try_at: now,
    enqueued_at: now,
    rev: 0,
  };
  if (i === -1) {
    if (write.op === 'soft_delete' && write.is_new) return [...queue]; // never existed anywhere
    return [...queue, fresh];
  }

  const existing = queue[i] as Mutation;
  const next = [...queue];
  if (write.op === 'soft_delete') {
    if (existing.is_new) {
      next.splice(i, 1);
      return next;
    }
    next[i] = {
      ...fresh,
      row: write.row,
      is_new: false,
      enqueued_at: existing.enqueued_at,
      rev: existing.rev + 1,
    };
    return next;
  }

  // upsert
  const row = existing.op === 'upsert' ? { ...existing.row, ...write.row } : write.row;
  next[i] = {
    ...fresh,
    row,
    is_new: existing.is_new,
    enqueued_at: existing.enqueued_at,
    rev: existing.rev + 1,
  };
  return next;
}

/** Writes ready to push for `owner`, oldest first. */
export function dueMutations(queue: readonly Mutation[], owner: string, now: number): Mutation[] {
  return queue
    .filter((m) => m.owner === owner && m.next_try_at <= now)
    .sort((a, b) => a.enqueued_at - b.enqueued_at);
}

/** Removes a pushed write — unless it was edited while the push was in flight. */
export function markSynced(queue: readonly Mutation[], clientId: string, rev: number): Mutation[] {
  return queue.filter((m) => !(m.client_id === clientId && m.rev === rev));
}

export type FailureResult = { queue: Mutation[]; dead: Mutation[] };

/**
 * Records a failed push. Permanent errors (constraint / validation / RLS) and
 * writes that failed DEAD_LETTER_AFTER times move to the dead-letter list.
 */
export function markFailed(
  queue: readonly Mutation[],
  dead: readonly Mutation[],
  clientId: string,
  rev: number,
  error: { kind: ErrorKind; message: string },
  now: number,
): FailureResult {
  const i = queue.findIndex((m) => m.client_id === clientId && m.rev === rev);
  if (i === -1) return { queue: [...queue], dead: [...dead] };
  const m = queue[i] as Mutation;
  const attempts = m.attempts + 1;
  const failed: Mutation = {
    ...m,
    attempts,
    next_try_at: now + backoffDelay(attempts),
    last_error: error.message,
    last_error_kind: error.kind,
  };
  const rest = queue.filter((_, j) => j !== i);
  if (error.kind === 'permanent' || attempts >= DEAD_LETTER_AFTER) {
    return { queue: rest, dead: [...dead, failed] };
  }
  const next = [...queue];
  next[i] = failed;
  return { queue: next, dead: [...dead] };
}

/** Back online: writes that only failed for lack of network are due right away. */
export function resetNetworkBackoff(queue: readonly Mutation[], now: number): Mutation[] {
  return queue.map((m) => (m.last_error_kind === 'network' ? { ...m, next_try_at: now } : m));
}

/** Moves dead-lettered writes back into the queue with a fresh attempt count. */
export function reviveDead(
  queue: readonly Mutation[],
  dead: readonly Mutation[],
  now: number,
): Mutation[] {
  const revived = dead.map((m) => ({
    ...m,
    attempts: 0,
    next_try_at: now,
    last_error: undefined,
    last_error_kind: undefined,
  }));
  return [...queue, ...revived];
}

type ErrorLike = { status?: unknown; code?: unknown; message?: unknown; name?: unknown };

/**
 * network   → no connection; don't burn the backoff, retry on reconnect.
 * retry     → server/auth hiccup (5xx, 401, expired JWT, rate limit).
 * permanent → the server rejected the row itself (constraint, type, RLS, 4xx).
 */
export function classifyError(error: unknown): ErrorKind {
  const e: ErrorLike = typeof error === 'object' && error !== null ? (error as ErrorLike) : {};
  const msg = typeof e.message === 'string' ? e.message : String(error);
  const code = typeof e.code === 'string' ? e.code : '';
  const status = typeof e.status === 'number' ? e.status : undefined;

  if (
    status === 0 ||
    /network request failed|failed to fetch|network error|timed? ?out|load failed/i.test(msg)
  ) {
    return 'network';
  }
  if (status === 401 || code === 'PGRST301' || code === 'PGRST303' || /jwt/i.test(msg))
    return 'retry';
  if (status === 429 || (status !== undefined && status >= 500)) return 'retry';
  if (/^(22|23)/.test(code) || code === '42501' || code === '42703' || code === 'PGRST204') {
    return 'permanent';
  }
  if (status !== undefined && status >= 400) return 'permanent';
  return 'retry';
}

/**
 * Server rows merged with this device's unsynced writes (PRD §3.2): pending
 * upserts override/extend server rows by client_id, pending soft deletes hide
 * them, and soft-deleted server rows are dropped.
 */
export function mergeByClientId<T extends { client_id: string; deleted_at?: string | null }>(
  serverRows: readonly T[],
  pending: readonly Mutation[],
): T[] {
  const byId = new Map<string, T>();
  for (const r of serverRows) byId.set(r.client_id, r);
  for (const m of pending) {
    if (m.op === 'soft_delete') {
      byId.delete(m.client_id);
    } else {
      const base = byId.get(m.client_id);
      byId.set(m.client_id, { ...(base ?? {}), ...m.row, client_id: m.client_id } as T);
    }
  }
  return [...byId.values()].filter((r) => !r.deleted_at);
}

export function pendingFor(queue: readonly Mutation[], table: SyncTable, owner: string | null) {
  return owner ? queue.filter((m) => m.table === table && m.owner === owner) : [];
}
