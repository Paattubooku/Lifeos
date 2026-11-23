import { useEffect, useRef } from 'react';

import { useLocalWrites } from '@/features/profile/hooks/useProfileData';
import type { BlockLike } from '@/features/routine/lib/blocks';
import { applyChanges } from '@/features/routine/slice';
import { addDays } from '@/lib/dates';
import { useAppDispatch } from '@/store';

import { useGetLogsSinceQuery } from '../api';
import { datesToFinalise, planDayScore, scoreForDate } from '../lib/finalise';
import { live, mergeKeepingDeleted } from '../lib/merge';
import { useDayHistory } from './useStreak';
import type { useToday } from './useToday';

type Today = ReturnType<typeof useToday>;

/** Reads fulfilled before this (a cache from the last session) are never used to finalise. */
const APP_STARTED_AT = Date.now();

/**
 * Keeps `day_log.score` / `is_streak_day` true (PRD F06): today's row follows
 * the live score; on open, past days without a final score (and yesterday)
 * are scored from their logs. Only acts on fresh server reads, never on a
 * stale cache from the last session.
 */
export function useDayScoreSync(t: Today) {
  const dispatch = useAppDispatch();
  const history = useDayHistory();
  const from = addDays(t.today, -8);
  const logsQ = useGetLogsSinceQuery(from);
  const blockWrites = useLocalWrites('block_log');
  const waterWrites = useLocalWrites('water_log');
  const foodWrites = useLocalWrites('food_log');
  const sessionWrites = useLocalWrites('session_log');
  const finalised = useRef<string | null>(null);

  // Today: follow the live score.
  const ready = !t.isLoading && t.plan.blocks.length > 0 && t.blockLogsLoaded;
  const score = t.day.score.score;
  const dayLog = t.dayLog;
  const templateId = t.plan.template?.id ?? null;
  useEffect(() => {
    if (!ready) return;
    const changes = planDayScore(t.today, dayLog ?? null, score, templateId);
    if (changes.length > 0) void dispatch(applyChanges(changes));
  }, [ready, score, dayLog, templateId, t.today, dispatch]);

  // Past days: once per logical day, from fresh data.
  const fresh =
    history.isSuccess &&
    history.fulfilledAt >= APP_STARTED_AT &&
    logsQ.isSuccess &&
    (logsQ.fulfilledTimeStamp ?? 0) >= APP_STARTED_AT &&
    !t.isLoading;
  useEffect(() => {
    if (!fresh || finalised.current === t.today || !logsQ.data) return;
    finalised.current = t.today;
    const logs = {
      blockLogs: mergeKeepingDeleted(logsQ.data.blockLogs, blockWrites),
      water: live(mergeKeepingDeleted(logsQ.data.water, waterWrites)),
      food: live(mergeKeepingDeleted(logsQ.data.food, foodWrites)),
      sessions: live(mergeKeepingDeleted(logsQ.data.sessions, sessionWrites)),
    };
    const changes = datesToFinalise(t.today, history.rows).flatMap((date) => {
      const row = history.rows.find((r) => r.date === date) ?? null;
      const { score: s, templateId: tpl } = scoreForDate(date, {
        templates: t.templates,
        blocks: t.allBlocks as BlockLike[],
        dayLog: row,
        logs,
        mealPlan: t.mealPlan,
        program: t.programCtx,
        waterTargetMl: t.waterTargetMl,
      });
      return planDayScore(date, row, s, tpl);
    });
    if (changes.length > 0) void dispatch(applyChanges(changes));
  }, [
    fresh,
    t,
    logsQ.data,
    history.rows,
    blockWrites,
    waterWrites,
    foodWrites,
    sessionWrites,
    dispatch,
  ]);
}
