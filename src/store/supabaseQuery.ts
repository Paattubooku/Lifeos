import type { AuthDeps } from '@/features/auth/slice';
import { serverRead } from '@/features/sync/slice';
import type { LifeosClient } from '@/lib/supabase';
import type { SyncTable } from '@/lib/sync';

type QueryApi = { extra: unknown; dispatch: (action: unknown) => unknown };
type Result<T> = { data: T } | { error: { message: string } };

const message = (e: unknown) =>
  typeof (e as { message?: unknown })?.message === 'string'
    ? (e as { message: string }).message
    : String(e);

/**
 * Runs a Supabase read for an RTK Query `queryFn`. After a successful read it
 * tells the sync queue which tables it has fresh data for, so the
 * recently-synced overlay for those tables can be dropped.
 */
export async function supabaseQuery<T>(
  api: QueryApi,
  tables: readonly SyncTable[],
  read: (client: LifeosClient) => Promise<T>,
): Promise<Result<T>> {
  const deps = api.extra as AuthDeps;
  if (!deps.isConfigured) return { error: { message: 'Supabase is not configured' } };
  const startedAt = deps.now?.() ?? Date.now();
  try {
    const data = await read(deps.getSupabase());
    for (const table of tables) api.dispatch(serverRead({ table, startedAt }));
    return { data };
  } catch (e) {
    return { error: { message: message(e) } };
  }
}

/** `{ data, error }` from `.maybeSingle()` → the row or null; throws on error. */
export function unwrapOne<R extends { data: unknown; error: unknown }>(
  res: R,
): NonNullable<R['data']> | null {
  if (res.error) throw res.error;
  return (res.data ?? null) as NonNullable<R['data']> | null;
}

/** `{ data, error }` from a list read → rows (never null); throws on error. */
export function unwrapList<R extends { data: unknown[] | null; error: unknown }>(
  res: R,
): NonNullable<R['data']> {
  if (res.error) throw res.error;
  return (res.data ?? []) as NonNullable<R['data']>;
}
