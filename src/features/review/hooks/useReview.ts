import { useMemo } from 'react';

import { useLocalWrites } from '@/features/profile/hooks/useProfileData';
import { planForDate } from '@/features/routine/lib/day';
import { useGetDoneBlocksSinceQuery } from '@/features/today/api';
import { useDayHistory } from '@/features/today/hooks/useStreak';
import type { useToday } from '@/features/today/hooks/useToday';
import { live, mergeKeepingDeleted } from '@/features/today/lib/merge';
import { addDays } from '@/lib/dates';

import { useGetReviewsQuery, useGetRollupQuery, type WeeklyReviewRow } from '../api';
import { reviewWeek, summaryFrom, weekDays, worstBlock } from '../lib/review';

/** All reviews, newest first, with this phone's unsynced writes. */
export function useReviews() {
  const q = useGetReviewsQuery();
  const writes = useLocalWrites('weekly_review');
  return useMemo(
    () =>
      live(mergeKeepingDeleted<WeeklyReviewRow>(q.data ?? [], writes)).sort((a, b) =>
        b.week_start.localeCompare(a.week_start),
      ),
    [q.data, writes],
  );
}

/** The week under review: summary (v_weekly_rollup + worst block), existing review, templates used. */
export function useReview(t: ReturnType<typeof useToday>) {
  const week = reviewWeek(t.today);
  const rollup = useGetRollupQuery(addDays(week, -7));
  const reviews = useReviews();
  const { rows: dayLogs } = useDayHistory();
  const doneQ = useGetDoneBlocksSinceQuery(addDays(t.today, -90));
  const blockWrites = useLocalWrites('block_log');

  const days = weekDays(week, t.today).map((date) =>
    planForDate(
      date,
      t.templates,
      t.allBlocks,
      dayLogs.find((d) => d.date === date),
    ),
  );
  const done = useMemo(() => {
    const rows = live(mergeKeepingDeleted(doneQ.data ?? [], blockWrites)).filter(
      (r) => r.status === 'done',
    );
    return new Set(rows.map((r) => `${r.date}:${r.block_id}`));
  }, [doneQ.data, blockWrites]);

  const worst = worstBlock(
    days.map((d) => ({ date: d.date, blocks: d.counted })),
    done,
  );
  const summary = summaryFrom(rollup.data ?? [], week, worst);
  const templateCounts = new Map<string, number>();
  for (const d of days)
    if (d.template)
      templateCounts.set(d.template.name, (templateCounts.get(d.template.name) ?? 0) + 1);

  return {
    week,
    summary,
    existing: reviews.find((r) => r.week_start === week) ?? null,
    templates: [...templateCounts.entries()].map(([n, c]) => `${n} ×${c}`).join(', '),
    loading: rollup.isLoading,
    offline: rollup.isError,
  };
}
