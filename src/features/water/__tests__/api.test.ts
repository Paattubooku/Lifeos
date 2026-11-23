import type { LifeosClient } from '@/lib/supabase';
import { fakeFrom } from '@/test/fakeQuery';
import { fakeSupabase, storeWithFake } from '@/test/fakeSupabase';

import { waterApi } from '../api';

const stores: { dispatch: (a: unknown) => unknown }[] = [];
afterEach(async () => {
  for (const s of stores.splice(0)) s.dispatch(waterApi.util.resetApiState());
  await new Promise((resolve) => setTimeout(resolve, 10));
});

it('getWaterSince reads live entries from a date', async () => {
  const fake = fakeSupabase();
  const db = fakeFrom({ water_log: [{ client_id: 'w', date: '2026-11-20', amount_ml: 500 }] });
  const { store } = storeWithFake({
    ...fake,
    client: { ...fake.client, from: db.from } as unknown as LifeosClient,
  });
  stores.push(store);
  const res = await store.dispatch(
    waterApi.endpoints.getWaterSince.initiate('2026-08-25', { subscribe: false }),
  );
  expect(res.data).toEqual([{ client_id: 'w', date: '2026-11-20', amount_ml: 500 }]);
  expect(db.calls[0]).toEqual([
    ['from', 'water_log'],
    ['select', 'client_id, date, amount_ml, deleted_at'],
    ['gte', 'date', '2026-08-25'],
    ['is', 'deleted_at', null],
  ]);
});
