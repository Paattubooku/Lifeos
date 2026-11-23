import type { Mutation } from '@/lib/sync';

type Keyed = { client_id: string; deleted_at?: string | null };

/**
 * Server rows + this phone's queued writes, **keeping** deleted rows (with
 * `deleted_at` set). Per-day tables need them: a new write for the same
 * day/key must reuse the deleted row's client_id (unique constraint).
 */
export function mergeKeepingDeleted<T extends Keyed>(
  rows: readonly T[],
  writes: readonly Mutation[],
): T[] {
  const byId = new Map<string, T>(rows.map((r) => [r.client_id, r]));
  for (const w of writes) {
    const base = byId.get(w.client_id);
    if (w.op === 'soft_delete') {
      if (base)
        byId.set(w.client_id, { ...base, deleted_at: String(w.row.deleted_at ?? 'deleted') });
    } else {
      byId.set(w.client_id, { ...(base ?? {}), ...w.row, client_id: w.client_id } as T);
    }
  }
  return [...byId.values()];
}

/** Live rows only. */
export const live = <T extends Keyed>(rows: readonly T[]) => rows.filter((r) => !r.deleted_at);
