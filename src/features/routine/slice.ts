import { createAsyncThunk } from '@reduxjs/toolkit';

import type { AuthDeps } from '@/features/auth/slice';
import { queueSoftDelete, queueUpsert, type SyncRoot } from '@/features/sync/slice';

import type { Change } from './lib/changes';

/**
 * Queues routine changes in order (templates before their blocks, so the
 * server sees the parent row first). Each write is optimistic.
 */
export const applyChanges = createAsyncThunk<
  number,
  readonly Change[],
  { extra: AuthDeps; state: SyncRoot }
>('routine/applyChanges', async (changes, { dispatch }) => {
  let applied = 0;
  for (const c of changes) {
    const res =
      c.op === 'upsert'
        ? await dispatch(queueUpsert({ table: c.table, row: c.row, clientId: c.clientId }))
        : await dispatch(queueSoftDelete({ table: c.table, clientId: c.clientId }));
    if (!('error' in res)) applied++;
  }
  return applied;
});
