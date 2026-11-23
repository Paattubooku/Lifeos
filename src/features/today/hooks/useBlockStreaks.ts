import { useMemo } from 'react';

import { useLocalWrites } from '@/features/profile/hooks/useProfileData';
import { addDays, type DateString } from '@/lib/dates';

import { useGetDoneBlocksSinceQuery } from '../api';
import { live, mergeKeepingDeleted } from '../lib/merge';
import { blockStreak } from '../lib/streak';

/** Days in a row each block was ticked (by block id), looking back 90 days. */
export function useBlockStreaks(today: DateString): Map<string, number> {
  const q = useGetDoneBlocksSinceQuery(addDays(today, -90));
  const writes = useLocalWrites('block_log');
  return useMemo(() => {
    const rows = live(mergeKeepingDeleted(q.data ?? [], writes)).filter((r) => r.status === 'done');
    const dates = new Map<string, Set<DateString>>();
    for (const r of rows) {
      const set = dates.get(r.block_id) ?? new Set<DateString>();
      set.add(r.date);
      dates.set(r.block_id, set);
    }
    return new Map([...dates].map(([id, set]) => [id, blockStreak(set, today)]));
  }, [q.data, writes, today]);
}
