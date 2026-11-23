import { fakeFrom } from '@/test/fakeQuery';
import { fakeSupabase, storeWithFake } from '@/test/fakeSupabase';
import type { LifeosClient } from '@/lib/supabase';

import { profileApi } from '../api';

function setup(tables: Record<string, unknown[]>, fail?: string) {
  const fake = fakeSupabase();
  const db = fakeFrom(tables, fail);
  const client = { ...fake.client, from: db.from } as unknown as LifeosClient;
  const { store } = storeWithFake({ ...fake, client });
  stores.push(store);
  return { store, calls: db.calls };
}

const stores: { dispatch: (a: unknown) => unknown }[] = [];
// Clear RTK Query's cache timers, then let its batched (rAF) notify run before teardown.
afterEach(async () => {
  for (const s of stores.splice(0)) s.dispatch(profileApi.util.resetApiState());
  await new Promise((resolve) => setTimeout(resolve, 10));
});

describe('profileApi', () => {
  it('reads the profile, routine and active program (live rows only)', async () => {
    const { store, calls } = setup({
      profile: [{ id: 'p' }],
      routine_template: [{ id: 't' }],
      routine_block: [{ id: 'b' }],
      workout_program: [{ id: 'w' }],
    });
    const p = await store.dispatch(
      profileApi.endpoints.getProfile.initiate(undefined, { subscribe: false }),
    );
    const r = await store.dispatch(
      profileApi.endpoints.getRoutine.initiate(undefined, { subscribe: false }),
    );
    const w = await store.dispatch(
      profileApi.endpoints.getActiveProgram.initiate(undefined, { subscribe: false }),
    );
    expect(p.data).toEqual({ id: 'p' });
    expect(r.data).toEqual({ templates: [{ id: 't' }], blocks: [{ id: 'b' }] });
    expect(w.data).toEqual({ id: 'w' });
    for (const chain of calls) expect(chain).toContainEqual(['is', 'deleted_at', null]);
    expect(store.getState().sync.recent).toEqual([]);
  });

  it('per-day reads include soft-deleted rows; latest weight orders by date', async () => {
    const { store, calls } = setup({
      day_log: [{ id: 'd' }],
      weight_log: [{ id: 'x' }],
    });
    expect(
      (
        await store.dispatch(
          profileApi.endpoints.getDayLog.initiate('2026-11-23', { subscribe: false }),
        )
      ).data,
    ).toEqual({ id: 'd' });
    expect(
      (
        await store.dispatch(
          profileApi.endpoints.getWeightOn.initiate('2026-11-23', { subscribe: false }),
        )
      ).data,
    ).toEqual({ id: 'x' });
    expect(
      (
        await store.dispatch(
          profileApi.endpoints.getLatestWeight.initiate(undefined, { subscribe: false }),
        )
      ).data,
    ).toEqual({
      id: 'x',
    });
    expect(calls[0]).toContainEqual(['eq', 'date', '2026-11-23']);
    expect(calls[0]).not.toContainEqual(['is', 'deleted_at', null]);
    expect(calls[2]).toContainEqual(['order', 'date', { ascending: false }]);
  });

  it('surfaces read errors', async () => {
    const { store } = setup({}, 'profile');
    const res = await store.dispatch(
      profileApi.endpoints.getProfile.initiate(undefined, { subscribe: false }),
    );
    expect(res.error).toEqual({ message: 'profile failed' });
    const empty = setup({});
    expect(
      (
        await empty.store.dispatch(
          profileApi.endpoints.getProfile.initiate(undefined, { subscribe: false }),
        )
      ).data,
    ).toBeNull();
  });
});
