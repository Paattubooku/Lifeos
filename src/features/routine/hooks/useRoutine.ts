import { useMemo } from 'react';

import { useGetDayLogQuery, useGetRoutineQuery } from '@/features/profile/api';
import { useLocalWrites, useMergedRows } from '@/features/profile/hooks/useProfileData';
import { addDays, todayLogical } from '@/lib/dates';
import { mergeByClientId } from '@/lib/sync';
import type { Tables } from '@/types/supabase';

import { useGetDayLogsSinceQuery } from '../api';
import { planForDate } from '../lib/day';

type DayLogRow = Tables<'day_log'>;

/** Templates, blocks and today's plan with this phone's unsynced edits applied. */
export function useRoutine(today = todayLogical()) {
  const routine = useGetRoutineQuery();
  const templates = useMergedRows('routine_template', routine.data?.templates);
  const blocks = useMergedRows('routine_block', routine.data?.blocks);

  const dayLogQuery = useGetDayLogQuery(today);
  const recentQuery = useGetDayLogsSinceQuery(addDays(today, -6));
  const dayLogWrites = useLocalWrites('day_log');

  // Today's row, including one created on this phone (e.g. by a switch) before it syncs.
  const todayDayLog = useMemo(() => {
    const server = dayLogQuery.data ? [{ ...dayLogQuery.data, deleted_at: null }] : [];
    const mine = dayLogWrites.filter(
      (w) => w.row.date === today || w.client_id === dayLogQuery.data?.client_id,
    );
    const merged = mergeByClientId<Partial<DayLogRow> & { client_id: string }>(server, mine);
    return merged[0] ?? (dayLogQuery.data ? { ...dayLogQuery.data } : null);
  }, [dayLogQuery.data, dayLogWrites, today]);

  const recentDayLogs = useMemo(
    () =>
      mergeByClientId(recentQuery.data ?? [], dayLogWrites).map((d) => ({
        date: String(d.date),
        template_id: (d.template_id as string | null | undefined) ?? null,
        deleted_at: d.deleted_at ?? null,
      })),
    [recentQuery.data, dayLogWrites],
  );

  const todayPlan = useMemo(
    () => planForDate(today, templates, blocks, todayDayLog),
    [today, templates, blocks, todayDayLog],
  );

  return {
    today,
    templates,
    blocks,
    todayDayLog,
    todayPlan,
    recentDayLogs,
    isLoading: routine.isLoading,
    isError: routine.isError && !routine.data,
  };
}
