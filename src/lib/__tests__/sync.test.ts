import {
  backoffDelay,
  classifyError,
  DEAD_LETTER_AFTER,
  dueMutations,
  enqueue,
  markFailed,
  markSynced,
  mergeByClientId,
  type Mutation,
  type NewWrite,
  pendingFor,
  resetNetworkBackoff,
  reviveDead,
} from '../sync';

const A = 'user-a';
const w = (over: Partial<NewWrite> = {}): NewWrite => ({
  client_id: 'c1',
  table: 'water_log',
  op: 'upsert',
  row: { date: '2026-11-23', amount_ml: 200 },
  owner: A,
  is_new: true,
  ...over,
});

describe('backoff schedule (1 s, 5 s, 30 s, 2 m, 10 m, then 10 m)', () => {
  it.each([
    [0, 0],
    [1, 1_000],
    [2, 5_000],
    [3, 30_000],
    [4, 120_000],
    [5, 600_000],
    [6, 600_000],
    [19, 600_000],
  ])('after %d failures → %d ms', (attempts, ms) => {
    expect(backoffDelay(attempts)).toBe(ms);
  });
});

describe('enqueue / queue collapse', () => {
  it('adds a new write due now', () => {
    const q = enqueue([], w(), 1000);
    expect(q).toEqual([
      expect.objectContaining({
        client_id: 'c1',
        attempts: 0,
        next_try_at: 1000,
        enqueued_at: 1000,
        rev: 0,
      }),
    ]);
  });

  it('collapses two edits of the same row into the latest upsert (merged)', () => {
    let q = enqueue([], w({ row: { date: '2026-11-23', amount_ml: 200 } }), 1000);
    q = enqueue(q, w({ row: { amount_ml: 500 }, is_new: false }), 2000);
    expect(q).toHaveLength(1);
    expect(q[0]).toMatchObject({
      op: 'upsert',
      row: { date: '2026-11-23', amount_ml: 500 },
      is_new: true, // still never synced
      enqueued_at: 1000, // keeps its place in line
      rev: 1,
      attempts: 0,
    });
  });

  it('drops both when an unsynced row is soft-deleted', () => {
    let q = enqueue([], w(), 1000);
    q = enqueue(q, w({ op: 'soft_delete', row: {} }), 2000);
    expect(q).toEqual([]);
  });

  it('ignores a soft delete of a new row that was never queued', () => {
    expect(enqueue([], w({ op: 'soft_delete', row: {}, is_new: true }), 1)).toEqual([]);
  });

  it('replaces a pending edit of a synced row with the soft delete', () => {
    let q = enqueue([], w({ is_new: false }), 1000);
    q = enqueue(q, w({ op: 'soft_delete', row: { deleted_at: 'T' }, is_new: false }), 2000);
    expect(q).toEqual([
      expect.objectContaining({ op: 'soft_delete', row: { deleted_at: 'T' }, rev: 1 }),
    ]);
  });

  it('upsert after a queued soft delete takes the new row', () => {
    let q = enqueue([], w({ op: 'soft_delete', row: {}, is_new: false }), 1000);
    q = enqueue(q, w({ row: { amount_ml: 750 }, is_new: false }), 2000);
    expect(q[0]).toMatchObject({ op: 'upsert', row: { amount_ml: 750 } });
  });

  it('keeps rows of different tables with the same id apart', () => {
    let q = enqueue([], w(), 1);
    q = enqueue(q, w({ table: 'coffee_log' }), 2);
    expect(q).toHaveLength(2);
  });
});

describe('due / synced / failed', () => {
  const base = (): Mutation[] => {
    let q = enqueue([], w({ client_id: 'b' }), 2000);
    q = enqueue(q, w({ client_id: 'a' }), 1000);
    q = enqueue(q, w({ client_id: 'other', owner: 'user-b' }), 500);
    return q;
  };

  it('returns this owner’s due writes, oldest first', () => {
    expect(dueMutations(base(), A, 5000).map((m) => m.client_id)).toEqual(['a', 'b']);
    expect(dueMutations(base(), A, 1500).map((m) => m.client_id)).toEqual(['a']);
  });

  it('markSynced removes the pushed revision only', () => {
    const q = base();
    expect(markSynced(q, 'a', 0).map((m) => m.client_id)).toEqual(['b', 'other']);
    // Edited while in flight (rev 1): the push of rev 0 must not remove it.
    const edited = enqueue(q, w({ client_id: 'a', row: { amount_ml: 1 } }), 3000);
    expect(markSynced(edited, 'a', 0).map((m) => m.client_id)).toContain('a');
  });

  it('markFailed backs off and records the error', () => {
    const { queue, dead } = markFailed(
      base(),
      [],
      'a',
      0,
      { kind: 'retry', message: '503' },
      10_000,
    );
    const a = queue.find((m) => m.client_id === 'a');
    expect(a).toMatchObject({
      attempts: 1,
      next_try_at: 11_000,
      last_error: '503',
      last_error_kind: 'retry',
    });
    expect(dead).toEqual([]);
  });

  it(`dead-letters after ${DEAD_LETTER_AFTER} attempts`, () => {
    let queue = enqueue([], w(), 0);
    let dead: Mutation[] = [];
    for (let i = 0; i < DEAD_LETTER_AFTER; i++) {
      ({ queue, dead } = markFailed(queue, dead, 'c1', 0, { kind: 'retry', message: 'x' }, i));
    }
    expect(queue).toEqual([]);
    expect(dead).toEqual([
      expect.objectContaining({ client_id: 'c1', attempts: DEAD_LETTER_AFTER }),
    ]);
  });

  it('dead-letters permanent errors immediately', () => {
    const { queue, dead } = markFailed(
      base(),
      [],
      'a',
      0,
      { kind: 'permanent', message: '23514' },
      1,
    );
    expect(queue.map((m) => m.client_id)).toEqual(['b', 'other']);
    expect(dead).toHaveLength(1);
  });

  it('ignores a failure for a stale revision', () => {
    const q = base();
    expect(markFailed(q, [], 'a', 9, { kind: 'retry', message: 'x' }, 1).queue).toEqual(q);
  });

  it('back online: network failures are due immediately, others keep their backoff', () => {
    let q = enqueue([], w({ client_id: 'n' }), 0);
    q = enqueue(q, w({ client_id: 'r' }), 0);
    for (let i = 0; i < 6; i++) {
      q = markFailed(q, [], 'n', 0, { kind: 'network', message: 'offline' }, 0).queue;
    }
    q = markFailed(q, [], 'r', 0, { kind: 'retry', message: '503' }, 0).queue;
    const reset = resetNetworkBackoff(q, 50);
    expect(reset.find((m) => m.client_id === 'n')?.next_try_at).toBe(50);
    expect(reset.find((m) => m.client_id === 'r')?.next_try_at).toBe(1_000);
  });

  it('reviveDead requeues with a clean slate', () => {
    const { dead } = markFailed(
      enqueue([], w(), 0),
      [],
      'c1',
      0,
      { kind: 'permanent', message: 'x' },
      0,
    );
    expect(reviveDead([], dead, 99)).toEqual([
      expect.objectContaining({
        client_id: 'c1',
        attempts: 0,
        next_try_at: 99,
        last_error: undefined,
      }),
    ]);
  });
});

describe('classifyError', () => {
  it.each([
    [new TypeError('Network request failed'), 'network'],
    [{ message: 'Failed to fetch' }, 'network'],
    [{ status: 0, message: '' }, 'network'],
    [{ status: 401, message: 'JWT expired' }, 'retry'],
    [{ code: 'PGRST301', message: 'JWT expired' }, 'retry'],
    [{ status: 503, message: 'Service Unavailable' }, 'retry'],
    [{ status: 429, message: 'rate limited' }, 'retry'],
    [{ code: '23505', message: 'duplicate key' }, 'permanent'],
    [{ code: '23514', message: 'check violation' }, 'permanent'],
    [{ code: '22P02', message: 'invalid input syntax' }, 'permanent'],
    [{ code: '42501', message: 'new row violates row-level security policy' }, 'permanent'],
    [{ code: 'PGRST204', message: 'column not found' }, 'permanent'],
    [{ status: 409, message: 'conflict' }, 'permanent'],
    [{ message: 'something odd' }, 'retry'],
    ['boom', 'retry'],
  ])('%p → %s', (error, kind) => {
    expect(classifyError(error)).toBe(kind);
  });
});

describe('mergeByClientId (server rows + unsynced local rows)', () => {
  type W = { client_id: string; amount_ml: number; deleted_at?: string | null };
  const server: W[] = [
    { client_id: 's1', amount_ml: 200 },
    { client_id: 's2', amount_ml: 500 },
    { client_id: 's3', amount_ml: 100, deleted_at: '2026-11-23T10:00:00Z' },
  ];

  it('overlays pending edits, adds new rows, hides pending and server deletes', () => {
    let q = enqueue([], w({ client_id: 's1', row: { amount_ml: 250 }, is_new: false }), 1);
    q = enqueue(q, w({ client_id: 'new', row: { amount_ml: 750 } }), 2);
    q = enqueue(q, w({ client_id: 's2', op: 'soft_delete', row: {}, is_new: false }), 3);
    expect(mergeByClientId(server, q)).toEqual([
      { client_id: 's1', amount_ml: 250 },
      { client_id: 'new', amount_ml: 750 },
    ]);
  });

  it('returns server rows unchanged without pending writes', () => {
    expect(mergeByClientId(server, [])).toEqual(server.slice(0, 2));
  });

  it('pendingFor filters by table and owner', () => {
    let q = enqueue([], w(), 1);
    q = enqueue(q, w({ client_id: 'x', table: 'coffee_log' }), 1);
    q = enqueue(q, w({ client_id: 'y', owner: 'someone' }), 1);
    expect(pendingFor(q, 'water_log', A).map((m) => m.client_id)).toEqual(['c1']);
    expect(pendingFor(q, 'water_log', null)).toEqual([]);
  });
});
