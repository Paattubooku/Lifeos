import type { useBody } from '@/features/body/hooks/useBody';
import { useGetDoneBlocksSinceQuery } from '@/features/today/api';
import { useDayHistory } from '@/features/today/hooks/useStreak';
import type { useToday } from '@/features/today/hooks/useToday';
import { live, mergeKeepingDeleted } from '@/features/today/lib/merge';
import { computeStreak } from '@/features/today/lib/streak';
import { useLocalWrites } from '@/features/profile/hooks/useProfileData';
import { planForDate } from '@/features/routine/lib/day';
import { addDays } from '@/lib/dates';
import { useAppSelector } from '@/store';

import {
  auditDay,
  fallback,
  interrupt,
  nextInterruptAt,
  type NudgeRowInput,
  pinnedFor,
  realityWeight,
  recovery,
  strictWeek,
} from '../lib/rules';

const hm = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

/** Every nudge for Today (PRD F24), evaluated from the day's rows and history. */
export function useAccountability(
  t: ReturnType<typeof useToday>,
  body: ReturnType<typeof useBody>,
  nowMin: number,
) {
  const enabled = useAppSelector((s) => s.notifications.enabled);
  const on = (k: 'interrupt' | 'missed_day' | 'fallback' | 'reality') => enabled[k] !== false;
  const snoozedUntil = useAppSelector((s) => s.accountability?.snoozedUntil ?? null);
  const { rows: history } = useDayHistory();
  const doneQ = useGetDoneBlocksSinceQuery(addDays(t.today, -90));
  const blockWrites = useLocalWrites('block_log');

  const rows = t.day.rows as unknown as NudgeRowInput[];
  const nudges = t.nudges;
  const yesterday = addDays(t.today, -1);
  const yLog = history.find((d) => d.date === yesterday && !d.deleted_at) ?? null;

  // Yesterday's hand-ticked counted blocks that weren't done (auto blocks can't be judged here).
  const doneY = new Set(
    live(mergeKeepingDeleted(doneQ.data ?? [], blockWrites))
      .filter((l) => l.date === yesterday && l.status === 'done')
      .map((l) => l.block_id),
  );
  const yPlan = planForDate(yesterday, t.templates, t.allBlocks, yLog);
  const missedTitles = yPlan.counted
    .filter((b) => !b.auto_complete && !doneY.has(b.id))
    .map((b) => b.title);

  const streak = computeStreak(history, t.today, t.day.score.score);
  const scores = history
    .filter((d) => !d.deleted_at)
    .map((d) => ({ date: d.date, score: d.score }));

  const rec = recovery({
    enabled: on('missed_day'),
    yesterdayScore: yLog?.score ?? null,
    missedTitles,
    today: rows,
    nudges,
    date: t.today,
  });
  const intr = interrupt({
    enabled: on('interrupt'),
    rows,
    nudges,
    date: t.today,
    now: t.now,
    snoozedUntil,
  });
  const nextAt = nextInterruptAt({
    enabled: on('interrupt'),
    rows,
    nowMin,
    shownToday: intr.shownToday,
    snoozedUntilMin:
      snoozedUntil !== null && snoozedUntil > t.now
        ? nowMin + Math.ceil((snoozedUntil - t.now) / 60000)
        : null,
  });
  const fb = fallback({
    enabled: on('fallback'),
    nowMin,
    done: t.day.score.done - t.rescues,
    counted: t.day.score.counted - t.rescues,
    nudges,
    date: t.today,
    graceAvailable: streak.graceAvailable,
  });
  const reality = realityWeight({
    enabled: on('reality'),
    today: t.today,
    avg7: body.points.map((p) => ({ date: p.date, avg7: p.avg7 })),
    scores,
    intake: body.intake,
    tdee: body.tdeeKcal,
    nudges,
  });
  const audit = auditDay({ enabled: on('reality'), today: t.today, scores, nudges });
  const pinnedId = pinnedFor(nudges, t.today);
  const pinned = pinnedId ? (rows.find((r) => r.block.client_id === pinnedId) ?? null) : null;

  return {
    recovery: { ...rec, yesterdayScore: yLog?.score ?? null, missedTitles },
    interrupt: intr,
    interruptAt: nextAt === null ? null : hm(nextAt),
    fallback: fb,
    reality,
    audit,
    pinned,
    strict: strictWeek(nudges, t.today),
    streak,
  };
}
