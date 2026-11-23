import type { LifeosClient } from '@/lib/supabase';
import { fakeFrom } from '@/test/fakeQuery';
import { fakeSupabase, storeWithFake } from '@/test/fakeSupabase';

import { foodApi } from '../api';

const stores: { dispatch: (a: unknown) => unknown }[] = [];
afterEach(async () => {
  for (const s of stores.splice(0)) s.dispatch(foodApi.util.resetApiState());
  await new Promise((resolve) => setTimeout(resolve, 10));
});

function run(tables: Record<string, unknown[]>) {
  const fake = fakeSupabase();
  const db = fakeFrom(tables);
  const { store } = storeWithFake({
    ...fake,
    client: { ...fake.client, from: db.from } as unknown as LifeosClient,
  });
  stores.push(store);
  return store.dispatch(foodApi.endpoints.getMealPlan.initiate(undefined, { subscribe: false }));
}

describe('foodApi.getMealPlan', () => {
  it('active plan, its meals, only their items, every dish', async () => {
    const res = await run({
      meal_plan: [{ id: 'p', client_id: 'pc', name: 'Fixed Day v1' }],
      meal: [{ id: 'm1', plan_id: 'p' }],
      meal_item: [
        { id: 'i1', meal_id: 'm1' },
        { id: 'i2', meal_id: 'other' },
      ],
      dish: [{ id: 'd1' }],
    });
    expect(res.data).toEqual({
      plan: { id: 'p', client_id: 'pc', name: 'Fixed Day v1' },
      meals: [{ id: 'm1', plan_id: 'p' }],
      items: [{ id: 'i1', meal_id: 'm1' }],
      dishes: [{ id: 'd1' }],
    });
  });

  it('no active plan → just the dishes', async () => {
    const res = await run({ dish: [{ id: 'd1' }] });
    expect(res.data).toEqual({ plan: null, meals: [], items: [], dishes: [{ id: 'd1' }] });
  });
});
