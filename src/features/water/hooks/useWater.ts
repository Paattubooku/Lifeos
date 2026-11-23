import { useMemo } from 'react';

import { useLocalWrites, useProfile } from '@/features/profile/hooks/useProfileData';
import { useRoutine } from '@/features/routine/hooks/useRoutine';
import { dayMinutes, hhmm } from '@/features/routine/lib/blocks';
import { useGetWaterLogsQuery } from '@/features/today/api';
import { live, mergeKeepingDeleted } from '@/features/today/lib/merge';
import { nowDayMinutes } from '@/features/today/lib/timeline';
import { addDays, logicalDate } from '@/lib/dates';

import { useGetWaterSinceQuery } from '../api';
import { waterPace } from '../lib/pace';
import { dailyTotals, waterStats } from '../lib/stats';

const DEFAULT_TARGET_TIME = '21:00';

/** Today's water, pace and stats with this phone's unsynced entries applied. */
export function useWater(now: number) {
  const today = logicalDate(now);
  const { profile } = useProfile();
  const { todayPlan } = useRoutine(today);
  const todayQ = useGetWaterLogsQuery(today);
  const historyQ = useGetWaterSinceQuery(addDays(today, -90));
  const writes = useLocalWrites('water_log');

  const entries = useMemo(
    () =>
      live(mergeKeepingDeleted(todayQ.data ?? [], writes))
        .filter((w) => w.date === today)
        .sort((a, b) => String(b.logged_at).localeCompare(String(a.logged_at))),
    [todayQ.data, writes, today],
  );
  const totalMl = entries.reduce((s, e) => s + e.amount_ml, 0);
  const targetMl = profile?.water_target_ml ?? 3000;

  const waters = todayPlan.blocks.filter((b) => b.kind === 'water');
  const targetTime = hhmm(waters[waters.length - 1]?.start_time ?? DEFAULT_TARGET_TIME);
  const wakeTime = hhmm(profile?.wake_time ?? '05:00');
  const pace = waterPace({
    nowMin: nowDayMinutes(now),
    wakeMin: dayMinutes(wakeTime),
    targetMin: dayMinutes(targetTime),
    sleepMin: dayMinutes(hhmm(profile?.sleep_time ?? '22:00')),
    targetMl,
    actualMl: totalMl,
  });

  const totals = dailyTotals(
    live(mergeKeepingDeleted(historyQ.data ?? [], writes)).filter((w) => w.date !== today),
  );
  totals.set(today, totalMl);
  const stats = waterStats(totals, today, targetMl);

  const beforeWake = nowDayMinutes(now) < dayMinutes(wakeTime);
  return { today, entries, totalMl, targetMl, targetTime, wakeTime, beforeWake, pace, stats };
}
