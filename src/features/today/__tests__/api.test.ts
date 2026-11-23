import type { LifeosClient } from '@/lib/supabase';
import { fakeFrom } from '@/test/fakeQuery';
import { fakeSupabase, storeWithFake } from '@/test/fakeSupabase';

import { todayApi } from '../api';

const stores: { dispatch: (a: unknown) => unknown }[] = [];
afterEach(async () => {
  for (const s of stores.splice(0)) s.dispatch(todayApi.util.resetApiState());
  await new Promise((resolve) => setTimeout(resolve, 10));
});

function setup(tables: Record<string, unknown[]>) {
  const fake = fakeSupabase();
  const db = fakeFrom(tables);
  const { store } = storeWithFake({
    ...fake,
    client: { ...fake.client, from: db.from } as unknown as LifeosClient,
  });
  stores.push(store);
  const run = <E extends keyof typeof todayApi.endpoints>(e: E, arg: unknown) =>
    store.dispatch(
      (todayApi.endpoints[e] as unknown as { initiate: (a: unknown, o: object) => never }).initiate(
        arg,
        { subscribe: false },
      ),
    ) as unknown as Promise<{ data?: unknown; error?: unknown }>;
  return { run, calls: db.calls };
}

describe('todayApi', () => {
  it('per-day logs', async () => {
    const { run, calls } = setup({
      block_log: [{ client_id: 'b' }],
      water_log: [{ client_id: 'w' }],
      food_log: [{ client_id: 'f' }],
      session_log: [{ client_id: 's' }],
      session_override: [{ client_id: 'o' }],
      sleep_log: [{ client_id: 'z' }],
    });
    const D = '2026-11-23';
    expect((await run('getBlockLogs', D)).data).toEqual([{ client_id: 'b' }]);
    expect((await run('getWaterLogs', D)).data).toEqual([{ client_id: 'w' }]);
    expect((await run('getFoodLogs', D)).data).toEqual([{ client_id: 'f' }]);
    expect((await run('getSessionOn', D)).data).toEqual({ client_id: 's' });
    expect((await run('getOverridesSince', D)).data).toEqual([{ client_id: 'o' }]);
    expect((await run('getSleepOn', D)).data).toEqual({ client_id: 'z' });
    expect(calls[0]).not.toContainEqual(['is', 'deleted_at', null]); // block logs keep deleted rows
    expect(calls[1]).toContainEqual(['is', 'deleted_at', null]);
  });

  it('active meal plan: only that plan’s items; none → empty', async () => {
    const { run } = setup({
      meal_plan: [{ id: 'p' }],
      meal: [{ id: 'm1', slot: 'lunch', plan_id: 'p' }],
      meal_item: [
        { meal_id: 'm1', dish_id: 'd' },
        { meal_id: 'other', dish_id: 'd' },
      ],
      dish: [{ id: 'd', name: 'Rice' }],
    });
    expect((await run('getActiveMealPlan', undefined)).data).toEqual({
      meals: [{ id: 'm1', slot: 'lunch', plan_id: 'p' }],
      items: [{ meal_id: 'm1', dish_id: 'd' }],
      dishes: [{ id: 'd', name: 'Rice' }],
    });
    expect((await setup({}).run('getActiveMealPlan', undefined)).data).toEqual({
      meals: [],
      items: [],
      dishes: [],
    });
  });

  it('program days with exercise names', async () => {
    const { run } = setup({
      workout_day: [{ id: 'd1', weekday: 1, title: 'Upper A' }],
      workout_exercise: [
        { workout_day_id: 'd1', exercise_id: 'e1', sort: 0 },
        { workout_day_id: 'd1', exercise_id: 'missing', sort: 1 },
        { workout_day_id: 'dx', exercise_id: 'e1', sort: 0 },
      ],
      exercise: [{ id: 'e1', name: 'Bench' }],
    });
    expect((await run('getProgramDays', 'prog')).data).toEqual({
      days: [{ id: 'd1', weekday: 1, title: 'Upper A' }],
      exercises: [
        { workout_day_id: 'd1', name: 'Bench', sort: 0 },
        { workout_day_id: 'd1', name: '', sort: 1 },
      ],
    });
  });
});
