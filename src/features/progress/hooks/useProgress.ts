import { useMemo } from 'react';

import { useBody } from '@/features/body/hooks/useBody';
import { useLocalWrites } from '@/features/profile/hooks/useProfileData';
import { useSleep } from '@/features/sleep/hooks/useSleep';
import { useStreak } from '@/features/today/hooks/useStreak';
import { useToday } from '@/features/today/hooks/useToday';
import { live, mergeKeepingDeleted } from '@/features/today/lib/merge';
import { heatmap } from '@/features/today/lib/streak';
import { useGetSessionsSinceQuery } from '@/features/train/api';
import type { SessionRow } from '@/features/train/lib/session';
import { thisWeek, weekSummary } from '@/features/train/lib/week';
import { useGetWaterSinceQuery } from '@/features/water/api';
import { dailyTotals } from '@/features/water/lib/stats';
import { addDays, weekStart } from '@/lib/dates';

import { useGetNutritionSinceQuery } from '../api';
import {
  avgLogged,
  dailyNutrition,
  FOOD_DAYS,
  TRAIN_WEEKS,
  waterDays,
  weeklySessions,
} from '../lib/progress';

/** Everything the Progress tab shows, with this phone's unsynced writes applied. */
export function useProgress(now: number) {
  const t = useToday(now);
  const today = t.today;
  const body = useBody(now);
  const sleep = useSleep(now);
  const todayScore = t.plan.blocks.length > 0 ? t.day.score.score : null;
  const { rows: dayRows, streak } = useStreak(today, todayScore);

  const nutQ = useGetNutritionSinceQuery(addDays(today, -(FOOD_DAYS - 1)));
  const foodWrites = useLocalWrites('food_log');
  const coffeeWrites = useLocalWrites('coffee_log');
  const sessQ = useGetSessionsSinceQuery(addDays(weekStart(today), -(TRAIN_WEEKS - 1) * 7));
  const sessionWrites = useLocalWrites('session_log');
  const waterQ = useGetWaterSinceQuery(addDays(today, -90));
  const waterWrites = useLocalWrites('water_log');

  const nutrition = useMemo(
    () =>
      dailyNutrition(
        live(mergeKeepingDeleted(nutQ.data?.food ?? [], foodWrites)),
        live(mergeKeepingDeleted(nutQ.data?.coffee ?? [], coffeeWrites)),
        today,
      ),
    [nutQ.data, foodWrites, coffeeWrites, today],
  );
  const sessions = useMemo(
    () => mergeKeepingDeleted<SessionRow>(sessQ.data ?? [], sessionWrites),
    [sessQ.data, sessionWrites],
  );
  const water = useMemo(
    () => dailyTotals(live(mergeKeepingDeleted(waterQ.data ?? [], waterWrites))),
    [waterQ.data, waterWrites],
  );

  const kcalTarget = t.profile?.kcal_target ?? 2000;
  const proteinTarget = t.profile?.protein_target_g ?? 150;
  const waterGoal = t.waterTargetMl;
  const weeks = weeklySessions(sessions, today);
  const week = weekSummary(thisWeek(today, t.programCtx, sessions));

  return {
    today,
    weight: { points: body.points, stats: body.stats, goal: body.goal },
    streak: {
      current: streak.current,
      best: streak.best?.length ?? 0,
      graceUsed: streak.graceDays.filter((d) => d >= addDays(today, -29)).length,
      cells: heatmap(dayRows, today, todayScore, streak.graceDays),
    },
    food: {
      ...nutrition,
      kcalAvg: avgLogged(nutrition.kcal, 7, true),
      proteinAvg: avgLogged(nutrition.protein, 7, true),
      kcalTarget,
      proteinTarget,
      tdee: body.tdeeKcal,
    },
    train: { weeks, done: week.done, planned: week.planned },
    sleep: { nights: sleep.nights, stats: sleep.stats },
    water: { ...waterDays(water, today, waterGoal), goal: waterGoal },
  };
}
