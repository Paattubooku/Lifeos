import { useMemo } from 'react';

import { COFFEE_KCAL } from '@/features/food/lib/extras';
import { useLocalWrites, useProfile } from '@/features/profile/hooks/useProfileData';
import { live, mergeKeepingDeleted } from '@/features/today/lib/merge';
import { addDays, type DateString, daysBetween, istDate, logicalDate } from '@/lib/dates';

import { useGetIntakeSinceQuery, useGetWeightsQuery, type WeightLogRow } from '../api';
import { ageFromBirthYear, bmr, measuredTdee, MEASURED_MIN, tdee, type Sex } from '../lib/energy';
import {
  intakeProjection,
  linearRegression,
  TREND_WINDOW_DAYS,
  trendProjection,
} from '../lib/projection';
import { weightStats, withAvg7 } from '../lib/weight';

/** Weight, trend, projections and energy for the logical day containing `now`. */
export function useBody(now: number) {
  const today = logicalDate(now);
  const { profile } = useProfile();
  const wq = useGetWeightsQuery();
  const iq = useGetIntakeSinceQuery(addDays(today, -(TREND_WINDOW_DAYS + 1)));
  const weightWrites = useLocalWrites('weight_log');
  const foodWrites = useLocalWrites('food_log');
  const coffeeWrites = useLocalWrites('coffee_log');

  const rows = useMemo(
    () => mergeKeepingDeleted<WeightLogRow>(wq.data ?? [], weightWrites),
    [wq.data, weightWrites],
  );
  const points = useMemo(() => withAvg7(rows), [rows]);
  const todayRow = rows.find((r) => r.date === today) ?? null;

  const intake = useMemo(() => {
    const m = new Map<DateString, number>();
    for (const f of live(mergeKeepingDeleted(iq.data?.food ?? [], foodWrites)))
      m.set(String(f.date), (m.get(String(f.date)) ?? 0) + Number(f.kcal ?? 0));
    for (const c of live(mergeKeepingDeleted(iq.data?.coffee ?? [], coffeeWrites)))
      m.set(String(c.date), (m.get(String(c.date)) ?? 0) + COFFEE_KCAL);
    return m;
  }, [iq.data, foodWrites, coffeeWrites]);

  const goal = Number(profile?.goal_weight_kg ?? 75);
  const stats = weightStats(
    points,
    today,
    profile?.start_weight_kg ? Number(profile.start_weight_kg) : null,
  );
  const height = Number(profile?.height_cm ?? 170);
  const sex: Sex = profile?.sex === 'female' ? 'female' : 'male';
  const age = ageFromBirthYear(profile?.birth_year ?? 1997, Number(istDate(now).slice(0, 4)));
  const factor = Number(profile?.activity_factor ?? 1.4);
  const weightForBmr =
    stats.avg7 ?? (profile?.start_weight_kg ? Number(profile.start_weight_kg) : 80);
  const bmrKcal = bmr({ sex, weightKg: weightForBmr, heightCm: height, age });
  const estimated = tdee(bmrKcal, factor);

  // Measured TDEE (A12): 28 days with ≥ 20 weigh-ins and ≥ 20 food-logged days.
  const from = addDays(today, -TREND_WINDOW_DAYS);
  const recent = points.filter((p) => p.date >= from && p.date < today);
  const foodDays = [...intake.entries()].filter(([d, k]) => d >= from && d < today && k > 0);
  const eligible =
    recent.length >= MEASURED_MIN.weighIns && foodDays.length >= MEASURED_MIN.foodDays;
  const slope = linearRegression(
    recent.map((p) => ({ x: daysBetween(from, p.date), y: p.avg7 })),
  ).slope;
  const measured =
    foodDays.length > 0
      ? measuredTdee(
          foodDays.reduce((s, [, k]) => s + k, 0) / foodDays.length,
          recent.length > 1 ? slope : 0,
        )
      : null;
  const tdeeKcal = eligible && measured !== null ? measured : estimated;

  return {
    today,
    profile,
    rows,
    points,
    todayRow,
    stats,
    goal,
    intake,
    eatenToday: intake.get(today) ?? 0,
    bmrKcal,
    weightForBmr,
    factor,
    estimated,
    measured,
    eligible,
    recentCounts: { weighIns: recent.length, foodDays: foodDays.length },
    tdeeKcal,
    trend: trendProjection(points, today, goal),
    intakeProj: intakeProjection(intake, tdeeKcal, stats.avg7, goal, today),
    isLoading: wq.isLoading,
  };
}
