import type { LifeosClient } from '@/lib/supabase';
import { fakeFrom } from '@/test/fakeQuery';
import { fakeSupabase, storeWithFake } from '@/test/fakeSupabase';

import { trainApi } from '../api';

const stores: { dispatch: (a: unknown) => unknown }[] = [];
afterEach(async () => {
  for (const s of stores.splice(0)) s.dispatch(trainApi.util.resetApiState());
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
  return { store, calls: db.calls };
}

describe('trainApi', () => {
  it('getProgram: the program’s days, only their items, the library', async () => {
    const { store, calls } = setup({
      workout_day: [{ id: 'd1' }],
      workout_exercise: [
        { id: 'a', workout_day_id: 'd1' },
        { id: 'b', workout_day_id: 'other' },
      ],
      exercise: [{ id: 'e1' }],
    });
    const res = await store.dispatch(
      trainApi.endpoints.getProgram.initiate('prog', { subscribe: false }),
    );
    expect(res.data).toEqual({
      days: [{ id: 'd1' }],
      items: [{ id: 'a', workout_day_id: 'd1' }],
      exercises: [{ id: 'e1' }],
    });
    expect(calls[0]).toContainEqual(['eq', 'program_id', 'prog']);
  });

  it('sets and sessions since a date', async () => {
    const { store, calls } = setup({
      set_log: [{ client_id: 's' }],
      session_log: [{ client_id: 'x' }],
    });
    expect(
      (
        await store.dispatch(
          trainApi.endpoints.getSetLogsSince.initiate('2026-09-24', { subscribe: false }),
        )
      ).data,
    ).toEqual([{ client_id: 's' }]);
    expect(
      (
        await store.dispatch(
          trainApi.endpoints.getSessionsSince.initiate('2026-11-10', { subscribe: false }),
        )
      ).data,
    ).toEqual([{ client_id: 'x' }]);
    expect(calls[0]).toContainEqual(['is', 'deleted_at', null]);
    expect(calls[1]).not.toContainEqual(['is', 'deleted_at', null]); // sessions keep deleted rows
  });

  it('getExerciseSets: one exercise, live, by date', async () => {
    const { store, calls } = setup({ set_log: [{ client_id: 'a' }] });
    expect(
      (
        await store.dispatch(
          trainApi.endpoints.getExerciseSets.initiate('bench', { subscribe: false }),
        )
      ).data,
    ).toEqual([{ client_id: 'a' }]);
    expect(calls[0]).toEqual([
      ['from', 'set_log'],
      ['select', '*'],
      ['eq', 'exercise_id', 'bench'],
      ['is', 'deleted_at', null],
      ['order', 'date'],
    ]);
  });
});
