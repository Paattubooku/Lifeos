import { useMemo } from 'react';

import { useLocalWrites, useProfile } from '@/features/profile/hooks/useProfileData';
import { hhmm } from '@/features/routine/lib/blocks';
import { type SleepLogRow, useGetSleepSinceQuery } from '@/features/today/api';
import { mergeKeepingDeleted } from '@/features/today/lib/merge';
import { addDays, logicalDate } from '@/lib/dates';

import { lastNights, morningCheck, NIGHTS, sleepStats } from '../lib/sleep';

/** The last 14 nights, last night, tonight's phone-away row and the morning check. */
export function useSleep(now: number) {
  const today = logicalDate(now);
  const { profile } = useProfile();
  const q = useGetSleepSinceQuery(addDays(today, -(NIGHTS - 1)));
  const writes = useLocalWrites('sleep_log');
  const rows = useMemo(
    () => mergeKeepingDeleted<SleepLogRow>(q.data ?? [], writes),
    [q.data, writes],
  );
  const target = {
    bed: hhmm(profile?.sleep_time ?? '22:00'),
    wake: hhmm(profile?.wake_time ?? '05:00'),
  };
  const lastNight = rows.find((r) => r.date === today) ?? null;
  const tonight = rows.find((r) => r.date === addDays(today, 1)) ?? null;
  const nights = lastNights(rows, today);
  return {
    today,
    target,
    rows,
    lastNight,
    tonight,
    nights,
    stats: sleepStats(nights),
    check: morningCheck(now, today, { wake_time: target.wake, sleep_time: target.bed }, lastNight),
    isLoading: q.isLoading,
  };
}
