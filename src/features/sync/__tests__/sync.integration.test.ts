import { persistStore } from 'redux-persist';

import { sessionChanged } from '@/features/auth/slice';
import { storage } from '@/lib/storage';
import { DEAD_LETTER_AFTER } from '@/lib/sync';
import { makeStore } from '@/store';
import { SESSION } from '@/test/fakeSupabase';
import { fakeSyncServer, waitForRehydrate } from '@/test/fakeSyncServer';

import { selectDeadCount, selectPendingCount, selectSyncSummary } from '../selectors';
import { connectivityChanged, queueSoftDelete, queueUpsert, retryDead, runSync } from '../slice';

const USER = { id: SESSION.user.id, email: SESSION.user.email };
const OTHER = { id: '00000000-0000-4000-a000-0000000000bb', email: 'b@example.com' };

let clock = 1_700_000_000_000;
const now = () => clock;

async function boot(server: ReturnType<typeof fakeSyncServer>, user = USER) {
  const store = makeStore({
    getSupabase: () => server.client,
    isConfigured: true,
    storageKey: 'lifeos-auth',
    now,
  });
  const persistor = persistStore(store);
  await waitForRehydrate(persistor);
  store.dispatch(sessionChanged(user));
  return { store, persistor };
}

const water = (ml: number) => ({
  table: 'water_log' as const,
  row: { date: '2026-11-23', amount_ml: ml, logged_at: '2026-11-23T05:10:00.000Z' },
});

beforeEach(async () => {
  clock = 1_700_000_000_000;
  await storage.removeItem('persist:lifeos-sync');
  await storage.removeItem('persist:lifeos-root');
});

describe('F02 AC1: offline writes survive an app kill and sync exactly once', () => {
  it('5 water entries in airplane mode → kill → reopen → reconnect → exactly 5 rows', async () => {
    const server = fakeSyncServer();

    // Session 1: airplane mode, log 5 entries.
    const first = await boot(server);
    first.store.dispatch(connectivityChanged({ online: false, now: clock }));
    server.setOffline(true);
    const ids: string[] = [];
    for (const ml of [200, 200, 500, 750, 200]) {
      ids.push((await first.store.dispatch(queueUpsert(water(ml)))).payload as string);
    }
    expect(new Set(ids).size).toBe(5);
    expect(selectPendingCount(first.store.getState())).toBe(5);
    expect(server.calls).toBe(0); // offline: nothing attempted
    await first.persistor.flush();
    first.persistor.pause(); // app killed

    // Session 2: cold start, still offline.
    const second = await boot(server);
    expect(selectPendingCount(second.store.getState())).toBe(5);
    second.store.dispatch(connectivityChanged({ online: false, now: clock }));

    // Reconnect.
    server.setOffline(false);
    clock += 1_000;
    second.store.dispatch(connectivityChanged({ online: true, now: clock }));
    await second.store.dispatch(runSync());

    expect(server.rows('water_log')).toHaveLength(5);
    expect(
      server
        .rows('water_log')
        .map((r) => r.client_id)
        .sort(),
    ).toEqual([...ids].sort());
    expect(selectPendingCount(second.store.getState())).toBe(0);
    expect(selectSyncSummary(second.store.getState())).toMatchObject({
      status: 'synced',
      pending: 0,
      lastSyncedAt: clock,
    });
  });

  it('retries after a lost acknowledgement never duplicate rows (upsert on client_id)', async () => {
    const server = fakeSyncServer();
    const { store } = await boot(server);
    store.dispatch(connectivityChanged({ online: true, now: clock }));
    server.failNext(
      { kind: 'ack-lost' },
      { kind: 'error', error: { status: 503, message: 'busy' } },
    );

    await store.dispatch(queueUpsert(water(200)));
    await store.dispatch(runSync()); // settle the push started by queueUpsert
    expect(server.rows('water_log')).toHaveLength(1); // saved, but the phone didn't hear back
    expect(selectPendingCount(store.getState())).toBe(1);

    for (let i = 0; i < 5 && selectPendingCount(store.getState()) > 0; i++) {
      clock += 60_000;
      await store.dispatch(runSync());
    }
    expect(selectPendingCount(store.getState())).toBe(0);
    expect(server.rows('water_log')).toHaveLength(1);
  });
});

describe('F02 AC2: pending returns to 0 right after reconnect', () => {
  it('long network backoff is reset by the reconnect event', async () => {
    const server = fakeSyncServer();
    const { store } = await boot(server);
    server.setOffline(true); // NetInfo hasn't noticed yet: pushes fail with network errors
    await store.dispatch(queueUpsert(water(200)));
    for (let i = 0; i < 6; i++) {
      clock += 600_000;
      await store.dispatch(runSync());
    }
    const entry = store.getState().sync.queue[0];
    expect(entry?.attempts).toBeGreaterThanOrEqual(5);
    expect(entry?.next_try_at).toBeGreaterThan(clock); // backed off ~10 min

    store.dispatch(connectivityChanged({ online: false, now: clock }));
    server.setOffline(false);
    clock += 1_000;
    store.dispatch(connectivityChanged({ online: true, now: clock }));
    await store.dispatch(runSync());
    expect(selectPendingCount(store.getState())).toBe(0);
  });
});

describe('queue edge cases end to end', () => {
  it('two edits before sync → one upsert with the latest values', async () => {
    const server = fakeSyncServer();
    const { store } = await boot(server);
    store.dispatch(connectivityChanged({ online: false, now: clock }));
    const id = (await store.dispatch(queueUpsert(water(200)))).payload as string;
    await store.dispatch(queueUpsert({ ...water(750), clientId: id }));
    expect(store.getState().sync.queue).toHaveLength(1);

    store.dispatch(connectivityChanged({ online: true, now: clock }));
    await store.dispatch(runSync());
    expect(server.calls).toBe(1);
    expect(server.rows('water_log')).toEqual([
      expect.objectContaining({ client_id: id, amount_ml: 750 }),
    ]);
  });

  it('soft delete of an unsynced row → nothing reaches the server', async () => {
    const server = fakeSyncServer();
    const { store } = await boot(server);
    store.dispatch(connectivityChanged({ online: false, now: clock }));
    const id = (await store.dispatch(queueUpsert(water(200)))).payload as string;
    await store.dispatch(queueSoftDelete({ table: 'water_log', clientId: id }));
    expect(store.getState().sync.queue).toEqual([]);
    store.dispatch(connectivityChanged({ online: true, now: clock }));
    await store.dispatch(runSync());
    expect(server.calls).toBe(0);
  });

  it('soft delete of a synced row sets deleted_at on the server', async () => {
    const server = fakeSyncServer();
    const { store } = await boot(server);
    store.dispatch(connectivityChanged({ online: true, now: clock }));
    const id = (await store.dispatch(queueUpsert(water(200)))).payload as string;
    await store.dispatch(runSync());
    expect(server.rows('water_log')[0]?.deleted_at).toBeUndefined();

    store.dispatch(connectivityChanged({ online: false, now: clock }));
    const deletedAt = clock;
    await store.dispatch(queueSoftDelete({ table: 'water_log', clientId: id }));
    clock += 3 * 3_600_000; // back online three hours later
    store.dispatch(connectivityChanged({ online: true, now: clock }));
    await store.dispatch(runSync());
    expect(server.rows('water_log')[0]?.deleted_at).toBe(new Date(deletedAt).toISOString());
    expect(selectPendingCount(store.getState())).toBe(0);
  });

  it('a rejected row is dead-lettered and shows a sync issue; Retry requeues it', async () => {
    const server = fakeSyncServer();
    const { store } = await boot(server);
    store.dispatch(connectivityChanged({ online: true, now: clock }));
    server.failNext({ kind: 'error', error: { code: '23514', message: 'check violation' } });
    await store.dispatch(queueUpsert(water(200)));
    await store.dispatch(runSync());
    expect(selectDeadCount(store.getState())).toBe(1);
    expect(selectSyncSummary(store.getState())).toMatchObject({
      status: 'issue',
      lastError: 'check violation',
    });

    store.dispatch(retryDead({ now: clock }));
    await store.dispatch(runSync());
    expect(selectDeadCount(store.getState())).toBe(0);
    expect(server.rows('water_log')).toHaveLength(1);
  });

  it(`gives up after ${DEAD_LETTER_AFTER} retryable failures`, async () => {
    const server = fakeSyncServer();
    const { store } = await boot(server);
    store.dispatch(connectivityChanged({ online: true, now: clock }));
    for (let i = 0; i < DEAD_LETTER_AFTER + 1; i++) {
      server.failNext({ kind: 'error', error: { status: 500, message: 'oops' } });
    }
    await store.dispatch(queueUpsert(water(200)));
    for (let i = 0; i < DEAD_LETTER_AFTER + 2; i++) {
      clock += 600_000;
      await store.dispatch(runSync());
    }
    expect(selectDeadCount(store.getState())).toBe(1);
    expect(selectPendingCount(store.getState())).toBe(0);
  });

  it('a thrown client error is treated as a failure, not a crash', async () => {
    const server = fakeSyncServer();
    const { store } = await boot(server);
    store.dispatch(connectivityChanged({ online: true, now: clock }));
    const from = server.client.from;
    (server.client as { from: unknown }).from = () => {
      throw new Error('kaboom');
    };
    await store.dispatch(queueUpsert(water(200)));
    await store.dispatch(runSync());
    expect(store.getState().sync.queue[0]).toMatchObject({ attempts: 1, last_error: 'kaboom' });
    (server.client as { from: unknown }).from = from;
  });
});

describe('ownership and gating', () => {
  it('signing out keeps unsynced changes; another account never pushes them', async () => {
    const server = fakeSyncServer();
    const { store } = await boot(server);
    store.dispatch(connectivityChanged({ online: false, now: clock }));
    await store.dispatch(queueUpsert(water(200)));

    store.dispatch(sessionChanged(null)); // signed out
    expect(store.getState().sync.queue).toHaveLength(1); // kept on this phone

    store.dispatch(sessionChanged(OTHER));
    store.dispatch(connectivityChanged({ online: true, now: clock }));
    await store.dispatch(runSync());
    expect(server.calls).toBe(0);
    expect(selectPendingCount(store.getState())).toBe(0); // not B's

    store.dispatch(sessionChanged(USER));
    await store.dispatch(runSync());
    expect(server.rows('water_log')).toHaveLength(1);
  });

  it('rejects writes when signed out', async () => {
    const server = fakeSyncServer();
    const { store } = await boot(server);
    store.dispatch(sessionChanged(null));
    const res = await store.dispatch(queueUpsert(water(200)));
    expect(res.meta.requestStatus).toBe('rejected');
    const del = await store.dispatch(queueSoftDelete({ table: 'water_log', clientId: 'x' }));
    expect(del.meta.requestStatus).toBe('rejected');
  });

  it('does not run without configuration', async () => {
    const server = fakeSyncServer();
    const store = makeStore({
      getSupabase: () => server.client,
      isConfigured: false,
      storageKey: 'lifeos-auth',
      now,
    });
    store.dispatch(sessionChanged(USER));
    await store.dispatch(queueUpsert(water(200)));
    await store.dispatch(runSync());
    expect(server.calls).toBe(0);
  });
});
