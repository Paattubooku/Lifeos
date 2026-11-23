import { useMemo } from 'react';

import { useGetActiveProgramQuery } from '@/features/profile/api';
import { useLocalWrites, useProfileContext } from '@/features/profile/hooks/useProfileData';
import { useRoutine } from '@/features/routine/hooks/useRoutine';
import { addDays, logicalDate, weekStart } from '@/lib/dates';

import {
  useGetActiveMealPlanQuery,
  useGetBlockLogsQuery,
  useGetFoodLogsQuery,
  useGetOverridesSinceQuery,
  useGetProgramDaysQuery,
  useGetSessionOnQuery,
  useGetSleepOnQuery,
  useGetWaterLogsQuery,
} from '../api';
import { eatenSlots, foodTotals } from '../lib/meals';
import { live, mergeKeepingDeleted } from '../lib/merge';
import { sessionFor } from '../lib/program';
import { nowDayMinutes } from '../lib/timeline';
import { buildDay } from '../selectors';

const EMPTY_PLAN = { meals: [], items: [], dishes: [] };

/** Everything the Today screen shows for the logical day containing `now`. */
export function useToday(now: number) {
  const today = logicalDate(now);
  const profileCtx = useProfileContext(today);
  const routine = useRoutine(today);

  const blockLogsQ = useGetBlockLogsQuery(today);
  const waterQ = useGetWaterLogsQuery(today);
  const foodQ = useGetFoodLogsQuery(today);
  const planQ = useGetActiveMealPlanQuery();
  const programQ = useGetActiveProgramQuery();
  const program = profileCtx.program ?? programQ.data ?? null;
  const daysQ = useGetProgramDaysQuery(program?.id ?? '', { skip: !program?.id });
  const sessionQ = useGetSessionOnQuery(today);
  const overridesQ = useGetOverridesSinceQuery(weekStart(today));
  const sleepQ = useGetSleepOnQuery(today);

  const blockLogWrites = useLocalWrites('block_log');
  const waterWrites = useLocalWrites('water_log');
  const foodWrites = useLocalWrites('food_log');
  const sessionWrites = useLocalWrites('session_log');
  const overrideWrites = useLocalWrites('session_override');
  const sleepWrites = useLocalWrites('sleep_log');

  const forToday = <T extends { row: Record<string, unknown> }>(ws: readonly T[]) =>
    ws.filter((w) => w.row.date === undefined || w.row.date === today);

  const blockLogs = useMemo(
    () =>
      mergeKeepingDeleted(blockLogsQ.data ?? [], forToday(blockLogWrites)).filter(
        (l) => l.date === today,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [blockLogsQ.data, blockLogWrites, today],
  );
  const water = useMemo(
    () => live(mergeKeepingDeleted(waterQ.data ?? [], waterWrites)).filter((w) => w.date === today),
    [waterQ.data, waterWrites, today],
  );
  const food = useMemo(
    () => live(mergeKeepingDeleted(foodQ.data ?? [], foodWrites)).filter((f) => f.date === today),
    [foodQ.data, foodWrites, today],
  );
  const overrides = useMemo(
    () => mergeKeepingDeleted(overridesQ.data ?? [], overrideWrites),
    [overridesQ.data, overrideWrites],
  );
  const sessionLog = useMemo(() => {
    const rows = mergeKeepingDeleted(sessionQ.data ? [sessionQ.data] : [], sessionWrites);
    return live(rows).find((s) => s.date === today) ?? null;
  }, [sessionQ.data, sessionWrites, today]);
  const sleep = useMemo(() => {
    const rows = mergeKeepingDeleted(sleepQ.data ? [sleepQ.data] : [], sleepWrites);
    return rows.find((s) => s.date === today) ?? null;
  }, [sleepQ.data, sleepWrites, today]);

  const mealPlan = planQ.data ?? EMPTY_PLAN;
  const programCtx = useMemo(
    () => ({ program, days: daysQ.data?.days ?? [], overrides }),
    [program, daysQ.data, overrides],
  );
  const session = sessionFor(today, programCtx);
  const exercises = useMemo(
    () =>
      (daysQ.data?.exercises ?? [])
        .filter((e) => e.workout_day_id === session?.id)
        .sort((a, b) => a.sort - b.sort)
        .map((e) => e.name),
    [daysQ.data, session?.id],
  );

  const profile = profileCtx.profile;
  const waterTargetMl = profile?.water_target_ml ?? 3000;
  const day = useMemo(
    () =>
      buildDay(
        routine.todayPlan.blocks,
        blockLogs,
        {
          water,
          waterTargetMl,
          eatenSlots: eatenSlots(food, mealPlan),
          session: session
            ? {
                kind: session.kind,
                completion: sessionLog?.completion ?? null,
                title: session.title,
              }
            : null,
        },
        nowDayMinutes(now),
      ),
    [
      routine.todayPlan.blocks,
      blockLogs,
      water,
      waterTargetMl,
      food,
      mealPlan,
      session,
      sessionLog,
      now,
    ],
  );

  return {
    now,
    today,
    yesterday: addDays(today, -1),
    profile,
    plan: routine.todayPlan,
    templates: routine.templates,
    dayLog: routine.todayDayLog,
    day,
    blockLogs,
    water,
    waterMl: water.reduce((s, w) => s + w.amount_ml, 0),
    waterTargetMl,
    food,
    foodTotals: foodTotals(food),
    mealPlan,
    programCtx,
    session,
    exercises,
    weightToday: profileCtx.todayWeight,
    latestWeightKg: profileCtx.latestWeightKg,
    sleep,
    isLoading: routine.isLoading || profileCtx.isLoading,
  };
}
