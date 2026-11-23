import { enqueue, type Mutation } from '@/lib/sync';

import {
  formatSyncedAgo,
  makeSelectPending,
  mergeWithPending,
  selectDeadCount,
  selectPendingCount,
  selectSyncSummary,
} from '../selectors';
import { initialSyncState, type SyncState } from '../slice';

const A = 'user-a';
const queue = (owners: string[]): Mutation[] =>
  owners.reduce<Mutation[]>(
    (q, owner, i) =>
      enqueue(
        q,
        {
          client_id: `c${i}`,
          table: 'water_log',
          op: 'upsert',
          row: { amount_ml: 200 },
          owner,
          is_new: true,
        },
        i,
      ),
    [],
  );

const root = (sync: Partial<SyncState>, user: string | null = A) => ({
  sync: { ...initialSyncState, ...sync },
  auth: { user: user ? { id: user } : null },
});

describe('sync selectors', () => {
  it('counts only the signed-in user’s pending and dead writes', () => {
    const s = root({ queue: queue([A, A, 'b']), dead: queue(['b', A]) });
    expect(selectPendingCount(s)).toBe(2);
    expect(selectDeadCount(s)).toBe(1);
    expect(selectPendingCount(root({ queue: queue([A]) }, null))).toBe(0);
    expect(selectDeadCount(root({ dead: queue([A]) }, null))).toBe(0);
  });

  it.each([
    [{ dead: queue([A]) }, 'issue'],
    [{ online: false, queue: queue([A]) }, 'offline'],
    [{ syncing: true }, 'syncing'],
    [{ queue: queue([A]) }, 'pending'],
    [{ lastSyncedAt: 123 }, 'synced'],
    [{}, 'never'],
  ] as const)('%p → %s', (sync, status) => {
    expect(selectSyncSummary(root(sync)).status).toBe(status);
  });

  it('makeSelectPending + mergeWithPending overlay local writes on server rows', () => {
    const s = root({ queue: queue([A, 'b']) });
    const pending = makeSelectPending('water_log')(s);
    expect(pending.map((m) => m.client_id)).toEqual(['c0']);
    expect(makeSelectPending('coffee_log')(s)).toEqual([]);
    expect(mergeWithPending([{ client_id: 'server', amount_ml: 500 }], pending)).toEqual([
      { client_id: 'server', amount_ml: 500 },
      { client_id: 'c0', amount_ml: 200 },
    ]);
  });
});

describe('formatSyncedAgo', () => {
  const t = 1_000_000_000;
  it.each([
    [0, 'just now'],
    [30_000, 'just now'],
    [120_000, '2 min ago'],
    [3 * 3_600_000, '3 h ago'],
    [26 * 3_600_000, '1 day ago'],
    [3 * 86_400_000, '3 days ago'],
    [-5_000, 'just now'],
  ])('%d ms → %s', (delta, text) => {
    expect(formatSyncedAgo(t, t + delta)).toBe(text);
  });
});
