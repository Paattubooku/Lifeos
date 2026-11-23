import { useMemo } from 'react';

import { makeSelectLocalWrites } from '@/features/sync/selectors';
import { todayLogical } from '@/lib/dates';
import { mergeByClientId, type Mutation, type SyncTable } from '@/lib/sync';
import { useAppSelector } from '@/store';

import {
  useGetActiveProgramQuery,
  useGetDayLogQuery,
  useGetLatestWeightQuery,
  useGetProfileQuery,
  useGetRoutineQuery,
  useGetWeightOnQuery,
} from '../api';

type Keyed = { client_id: string; deleted_at?: string | null };

/**
 * A single server row with this device's unconfirmed writes applied. Only
 * overlays an existing row: a partial edit can't stand in for a missing row.
 */
export function mergeOne<T extends Keyed>(row: T | null | undefined, writes: readonly Mutation[]) {
  if (!row) return row;
  const mine = writes.filter((w) => w.client_id === row.client_id);
  if (mine.length === 0) return row;
  const merged = mergeByClientId([{ ...row, deleted_at: null }], mine)[0];
  return merged ?? null;
}

const selectors = new Map<SyncTable, ReturnType<typeof makeSelectLocalWrites>>();
function selectorFor(table: SyncTable) {
  let s = selectors.get(table);
  if (!s) selectors.set(table, (s = makeSelectLocalWrites(table)));
  return s;
}

export function useLocalWrites(table: SyncTable): Mutation[] {
  return useAppSelector(selectorFor(table));
}

/** List rows from the server merged with local writes (new rows included). */
export function useMergedRows<T extends Keyed>(
  table: SyncTable,
  rows: readonly T[] | undefined,
): T[] {
  const writes = useLocalWrites(table);
  return useMemo(() => mergeByClientId(rows ?? [], writes), [rows, writes]);
}

export function useProfile(options: { skip?: boolean } = {}) {
  const q = useGetProfileQuery(undefined, { skip: options.skip });
  const writes = useLocalWrites('profile');
  const profile = useMemo(() => mergeOne(q.data, writes), [q.data, writes]);
  return { profile, isLoading: q.isLoading, isFetching: q.isFetching, isError: q.isError };
}

/** Everything onboarding and Settings → Profile need, with local writes applied. */
export function useProfileContext(today = todayLogical()) {
  const { profile, isLoading: profileLoading } = useProfile();
  const routine = useGetRoutineQuery();
  const dayLog = useGetDayLogQuery(today);
  const weightToday = useGetWeightOnQuery(today);
  const latestWeight = useGetLatestWeightQuery();
  const program = useGetActiveProgramQuery();

  const blocks = useMergedRows('routine_block', routine.data?.blocks);
  const templates = useMergedRows('routine_template', routine.data?.templates);
  const dayLogWrites = useLocalWrites('day_log');
  const weightWrites = useLocalWrites('weight_log');
  const programWrites = useLocalWrites('workout_program');

  const todayWeight = useMemo(() => {
    const local = weightWrites.find((w) => w.row.date === today && w.op === 'upsert');
    return (
      mergeOne(weightToday.data, weightWrites) ??
      (local
        ? { client_id: local.client_id, weight_kg: Number(local.row.weight_kg), deleted_at: null }
        : null)
    );
  }, [weightToday.data, weightWrites, today]);

  const todayDayLog = useMemo(() => {
    const local = dayLogWrites.find((w) => w.row.date === today && w.op === 'upsert');
    return (
      mergeOne(dayLog.data, dayLogWrites) ??
      (local ? { client_id: local.client_id, deleted_at: null } : null)
    );
  }, [dayLog.data, dayLogWrites, today]);

  return {
    today,
    profile,
    blocks,
    templates,
    todayDayLog,
    todayWeight,
    latestWeightKg:
      todayWeight && !todayWeight.deleted_at
        ? Number(todayWeight.weight_kg)
        : latestWeight.data
          ? Number(latestWeight.data.weight_kg)
          : null,
    program: mergeOne(program.data, programWrites) ?? null,
    isLoading: profileLoading || routine.isLoading,
  };
}
