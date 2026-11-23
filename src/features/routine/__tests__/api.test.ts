import type { LifeosClient } from '@/lib/supabase';
import { fakeFrom } from '@/test/fakeQuery';
import { fakeSupabase, storeWithFake } from '@/test/fakeSupabase';

import { routineApi } from '../api';

const stores: { dispatch: (a: unknown) => unknown }[] = [];
afterEach(async () => {
  for (const s of stores.splice(0)) s.dispatch(routineApi.util.resetApiState());
  await new Promise((resolve) => setTimeout(resolve, 10));
});

it('getDayLogsSince reads live day logs from a date', async () => {
  const fake = fakeSupabase();
  const db = fakeFrom({ day_log: [{ client_id: 'a', date: '2026-11-20', template_id: 't' }] });
  const { store } = storeWithFake({
    ...fake,
    client: { ...fake.client, from: db.from } as unknown as LifeosClient,
  });
  stores.push(store);
  const res = await store.dispatch(
    routineApi.endpoints.getDayLogsSince.initiate('2026-11-17', { subscribe: false }),
  );
  expect(res.data).toEqual([{ client_id: 'a', date: '2026-11-20', template_id: 't' }]);
  expect(db.calls[0]).toEqual([
    ['from', 'day_log'],
    ['select', 'client_id, date, template_id, deleted_at'],
    ['gte', 'date', '2026-11-17'],
    ['is', 'deleted_at', null],
  ]);
});
