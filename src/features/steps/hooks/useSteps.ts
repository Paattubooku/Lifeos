import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useLocalWrites, useProfile } from '@/features/profile/hooks/useProfileData';
import { applyChanges } from '@/features/routine/slice';
import { mergeKeepingDeleted } from '@/features/today/lib/merge';
import { addDays, logicalDate } from '@/lib/dates';
import { useAppDispatch, useAppSelector } from '@/store';

import { type StepsLogRow, useGetStepsSinceQuery } from '../api';
import { loadHealth } from '../lib/health';
import {
  motionAvailable,
  motionStepsByDay,
  motionToday,
  requestMotion,
  watchMotion,
} from '../lib/motion';
import { healthWrites, lastDays, planSteps, targets, weekStats } from '../lib/steps';
import { healthLinked, healthRead, motionLinked } from '../slice';

let inFlight: Promise<boolean> | null = null;
/** Run one automatic sync at a time; overlapping callers share the running one. */
function once(run: () => Promise<boolean>): Promise<boolean> {
  inFlight ??= run().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

/** Days of history read from Health and shown (PRD: last 30 days). */
export const HISTORY_DAYS = 30;

/** Today's steps, 14-day bars, targets and the Health link (F21). */
export function useSteps(now: number) {
  const today = logicalDate(now);
  const dispatch = useAppDispatch();
  const { profile } = useProfile();
  const link = useAppSelector((s) => s.steps.health);
  // Older persisted state has no `motion` key.
  const motion = useAppSelector((s) => s.steps.motion ?? 'off');
  const lastReadAt = useAppSelector((s) => s.steps.lastReadAt);
  const q = useGetStepsSinceQuery(addDays(today, -(HISTORY_DAYS - 1)));
  const writes = useLocalWrites('steps_log');
  const rows = useMemo(
    () => mergeKeepingDeleted<StepsLogRow>(q.data ?? [], writes),
    [q.data, writes],
  );
  // Syncs read the newest rows (not the render they started in) and never overlap:
  // two overlapping reads would both see "no row" and create two rows for a day.
  const rowsRef = useRef(rows);
  useEffect(() => {
    rowsRef.current = rows;
  });
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
      const changes = healthWrites(counts, rowsRef.current);
      if (changes.length) await dispatch(applyChanges(changes));
      dispatch(healthRead(at));
      return true;
    },
    [dispatch],
  );

  /** Read the last 7 days from the iPhone's motion chip and store what changed. */
  const syncMotion = useCallback(
    async (at: number) => {
      const counts = await motionStepsByDay(at);
      const changes = healthWrites(counts, rowsRef.current, 'phone');
      if (changes.length) await dispatch(applyChanges(changes));
      dispatch(healthRead(at));
      return true;
    },
    [dispatch],
  );

  /** The automatic source in use: Apple Health if connected, else the motion chip. */
  const auto: 'health' | 'phone' | null =
    link === 'connected' ? 'health' : motion === 'on' ? 'phone' : null;
  const syncAuto = useCallback(
    (at: number) =>
      once(() =>
        link === 'connected'
          ? syncHealth(at)
          : motion === 'on'
            ? syncMotion(at)
            : Promise.resolve(false),
      ),
    [link, motion, syncHealth, syncMotion],
  );

  /** Turn on free automatic counting (Motion & Fitness permission). */
  const startCounting = async (at: number): Promise<'on' | 'denied' | 'unavailable'> => {
    if (!(await motionAvailable())) return 'unavailable';
    const ok = await requestMotion();
    dispatch(motionLinked(ok ? 'on' : 'denied'));
    if (ok) await once(() => syncMotion(at)).catch(() => false);
    return ok ? 'on' : 'denied';
  };

  /** Ask for read access; denied (or no Health on this build) leaves manual entry. */
  const connect = async (at: number): Promise<'connected' | 'denied' | 'unavailable'> => {
    const health = await loadHealth();
    if (!health) return 'unavailable';
    try {
      const ok = await health.authorize();
      dispatch(healthLinked(ok ? 'connected' : 'denied'));
      if (ok) await once(() => syncHealth(at));
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
    motion,
    auto,
    lastReadAt,
    connect,
    startCounting,
    syncHealth,
    syncAuto,
    setToday,
    disconnect: () => dispatch(healthLinked('off')),
    stopCounting: () => dispatch(motionLinked('off')),
  };
}

/**
 * Live total while a screen is open (motion chip): today's count when the
 * watch starts + steps since. null when not counting automatically.
 */
export function useLiveSteps(on: boolean, now: number): number | null {
  const [live, setLive] = useState<number | null>(null);
  useEffect(() => {
    if (!on) return undefined;
    let base: number | null = null;
    let since = 0;
    let stop: () => void = () => undefined;
    let cancelled = false;
    void motionToday(now)
      .then((b) => {
        if (cancelled) return;
        base = b;
        setLive(b + since);
        stop = watchMotion((n) => {
          since = n;
          if (base !== null) setLive(base + n);
        });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      stop();
    };
    // Start once per screen visit; `now` only seeds the first read.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on]);
  return on ? live : null;
}
