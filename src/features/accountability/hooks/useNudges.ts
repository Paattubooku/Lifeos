import { useMemo } from 'react';

import { useLocalWrites } from '@/features/profile/hooks/useProfileData';
import { mergeKeepingDeleted } from '@/features/today/lib/merge';
import { addDays, type DateString } from '@/lib/dates';

import { type NudgeLogRow, useGetNudgesSinceQuery } from '../api';

/** Nudge log for the last 14 days (the longest limit is 7 days) with local writes. */
export function useNudges(today: DateString) {
  const q = useGetNudgesSinceQuery(addDays(today, -14));
  const writes = useLocalWrites('nudge_log');
  return useMemo(() => mergeKeepingDeleted<NudgeLogRow>(q.data ?? [], writes), [q.data, writes]);
}
