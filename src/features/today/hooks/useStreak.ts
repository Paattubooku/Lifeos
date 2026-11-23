import { useMemo } from 'react';

import { useLocalWrites } from '@/features/profile/hooks/useProfileData';
import type { DateString } from '@/lib/dates';

import { type DayScoreRow, useGetDayHistoryQuery } from '../api';
import { mergeKeepingDeleted } from '../lib/merge';
import { computeStreak } from '../lib/streak';

/** day_log scores (server + this phone's writes, deleted rows kept). */
export function useDayHistory(): { rows: DayScoreRow[]; isSuccess: boolean; fulfilledAt: number } {
  const q = useGetDayHistoryQuery();
  const writes = useLocalWrites('day_log');
  const rows = useMemo(() => mergeKeepingDeleted(q.data ?? [], writes), [q.data, writes]);
  return { rows, isSuccess: q.isSuccess, fulfilledAt: q.fulfilledTimeStamp ?? 0 };
}

/** Streak with today's live score (today only adds, never breaks). */
export function useStreak(today: DateString, todayScore: number | null) {
  const { rows } = useDayHistory();
  return useMemo(
    () => ({ rows, streak: computeStreak(rows, today, todayScore) }),
    [rows, today, todayScore],
  );
}
