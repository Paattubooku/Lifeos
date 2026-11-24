import { useCallback, useMemo } from 'react';

import { useLocalWrites, useProfile } from '@/features/profile/hooks/useProfileData';
import { applyChanges } from '@/features/routine/slice';
import { mergeKeepingDeleted } from '@/features/today/lib/merge';
import { addDays, logicalDate } from '@/lib/dates';
import { useAppDispatch, useAppSelector } from '@/store';

import { type StepsLogRow, useGetStepsSinceQuery } from '../api';
import { loadHealth } from '../lib/health';
import { healthWrites, lastDays, planSteps, targets, weekStats } from '../lib/steps';
import { healthLinked, healthRead } from '../slice';

/** Days of history read from Health and shown (PRD: last 30 days). */
export const HISTORY_DAYS = 30;

/** Today's steps, 14-day bars, targets and the Health link (F21). */
export function useSteps(now: number) {
  const today = logicalDate(now);
  const dispatch = useAppDispatch();
  const { profile } = useProfile();
  const link = useAppSelector((s) => s.steps.health);
  const lastReadAt = useAppSelector((s) => s.steps.lastReadAt);
  const q = useGetStepsSinceQuery(addDays(today, -(HISTORY_DAYS - 1)));
  const writes = useLocalWrites('steps_log');
  const rows = useMemo(
    () => mergeKeepingDeleted<StepsLogRow>(q.data ?? [], writes),
    [q.data, writes],
  );
  const t = targets(profile?.steps_min);
  const todayRow = rows.find((r) => r.date === today) ?? null;
  const days = lastDays(rows, today);
  const count = todayRow && !todayRow.deleted_at ? todayRow.steps : null;

  /** Pull the last 30 days from Health and store what changed (no-op without Health). */
  const syncHealth = useCallback(
    async (at: number) => {
      const health = await loadHealth();
      if (!health) return false;
      const counts = await health.stepsByDay(HISTORY_DAYS, at);
      const changes = healthWrites(counts, rows);
      if (changes.length) await dispatch(applyChanges(changes));
      dispatch(healthRead(at));
      return true;
    },
    [dispatch, rows],
  );

  /** Ask for read access; denied (or no Health on this build) leaves manual entry. */
  const connect = async (at: number): Promise<'connected' | 'denied' | 'unavailable'> => {
    const health = await loadHealth();
    if (!health) return 'unavailable';
    try {
      const ok = await health.authorize();
      dispatch(healthLinked(ok ? 'connected' : 'denied'));
      if (ok) await syncHealth(at);
      return ok ? 'connected' : 'denied';
    } catch {
      dispatch(healthLinked('denied'));
      return 'denied';
    }
  };

  const setToday = (steps: number) =>
    dispatch(applyChanges(planSteps(today, todayRow, steps, 'manual')));

  return {
    today,
    count,
    targets: t,
    days,
    rows,
    week: weekStats(days, t.min),
    link,
    lastReadAt,
    connect,
    syncHealth,
    setToday,
    disconnect: () => dispatch(healthLinked('off')),
  };
}
