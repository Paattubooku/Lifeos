import { useMemo } from 'react';

import { useLocalWrites } from '@/features/profile/hooks/useProfileData';
import { mergeKeepingDeleted } from '@/features/today/lib/merge';
import { addDays, logicalDate, logicalMoment } from '@/lib/dates';

import { type TaskDbRow, useGetTasksQuery } from '../api';
import { COMPLETED_DAYS, completed, headerLine, pending, suggestions, top3 } from '../lib/tasks';

/** Tasks with this phone's unsynced writes applied, split into the screen's lists. */
export function useTasks(now: number) {
  const today = logicalDate(now);
  // Day-stable cache key: the start of the logical day 14 days ago.
  const from = new Date(logicalMoment(addDays(today, -COMPLETED_DAYS), '03:00')).toISOString();
  const q = useGetTasksQuery(from);
  const writes = useLocalWrites('task');
  const all = useMemo(
    () => mergeKeepingDeleted<TaskDbRow>(q.data ?? [], writes).filter((t) => !t.deleted_at),
    [q.data, writes],
  );
  return {
    today,
    all,
    top3: top3(all, today),
    pending: pending(all, today),
    completed: completed(all, now),
    suggestions: suggestions(all, today).filter((s) => !top3(all, today).includes(s)),
    header: headerLine(all, today),
    isLoading: q.isLoading,
  };
}
