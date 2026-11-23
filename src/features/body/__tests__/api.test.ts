import type { LifeosClient } from '@/lib/supabase';
import { fakeFrom } from '@/test/fakeQuery';
import { fakeSupabase, storeWithFake } from '@/test/fakeSupabase';

import { bodyApi } from '../api';

const stores: { dispatch: (a: unknown) => unknown }[] = [];
afterEach(async () => {
  for (const s of stores.splice(0)) s.dispatch(bodyApi.util.resetApiState());
  await new Promise((resolve) => setTimeout(resolve, 10));
});

it('weights (deleted kept) and intake since a date', async () => {
  const fake = fakeSupabase();
  const db = fakeFrom({
    weight_log: [{ client_id: 'w' }],
    food_log: [{ client_id: 'f' }],
    coffee_log: [{ client_id: 'c' }],
  });
  const { store } = storeWithFake({
    ...fake,
    client: { ...fake.client, from: db.from } as unknown as LifeosClient,
  });
  stores.push(store);
  expect(
    (await store.dispatch(bodyApi.endpoints.getWeights.initiate(undefined, { subscribe: false })))
      .data,
  ).toEqual([{ client_id: 'w' }]);
  expect(
    (
      await store.dispatch(
        bodyApi.endpoints.getIntakeSince.initiate('2026-10-26', { subscribe: false }),
      )
    ).data,
  ).toEqual({
    food: [{ client_id: 'f' }],
    coffee: [{ client_id: 'c' }],
  });
  expect(db.calls[0]).not.toContainEqual(['is', 'deleted_at', null]);
  expect(db.calls[1]).toContainEqual(['gte', 'date', '2026-10-26']);
});
