import { useMemo } from 'react';

import type { useFood } from '@/features/food/hooks/useFood';
import { hhmm } from '@/features/routine/lib/blocks';
import { planForDate } from '@/features/routine/lib/day';
import type { useToday } from '@/features/today/hooks/useToday';
import { sessionFor } from '@/features/today/lib/program';
import type { useWater } from '@/features/water/hooks/useWater';
import { addDays } from '@/lib/dates';
import { useAppSelector } from '@/store';

import { buildSchedule, type DayInput } from '../schedule';

type Sources = {
  t: ReturnType<typeof useToday>;
  food: ReturnType<typeof useFood>;
  water: ReturnType<typeof useWater>;
  /** Weeks already reviewed (F20), so their Sunday reminder is dropped. */
  reviewedWeeks?: ReadonlySet<string>;
  /** F24: today's failure-interrupt time ('HH:mm') or null. */
  interruptAt?: string | null;
};

/** Dish names per slot from a day's meal views ("Idli + Sambar + Boiled eggs"). */
const dishNames = (meals: ReturnType<typeof useFood>['day']['meals']) =>
  Object.fromEntries(meals.map((m) => [m.meal.slot, m.groups.map((g) => g.dish.name).join(' + ')]));

/** Today's and tomorrow's reminders from the same data the screens show. */
export function useReminderSchedule({ t, food, water, reviewedWeeks, interruptAt }: Sources) {
  const enabled = useAppSelector((s) => s.notifications.enabled);
  const quietDate = useAppSelector((s) => s.notifications.quietDate);
  const profile = t.profile;

  return useMemo(() => {
    if (!profile) return [];
    const tomorrow = addDays(t.today, 1);
    const tomorrowPlan = planForDate(tomorrow, t.templates, t.allBlocks, null);
    const loggedSlots = new Set(
      food.day.meals
        .filter((m) => m.status === 'eaten' || m.status === 'partly')
        .map((m) => m.meal.slot),
    );
    const todaySession = t.session;
    const tomorrowSession = sessionFor(tomorrow, t.programCtx);
    const days: DayInput[] = [
      {
        date: t.today,
        blocks: t.plan.blocks,
        session: todaySession ? { title: todaySession.title, kind: todaySession.kind } : null,
        mealDishes: dishNames(food.day.meals),
        loggedSlots,
        waterMl: water.totalMl,
        score: t.plan.blocks.length > 0 ? t.day.score.score : null,
        interruptAt: interruptAt ?? null,
      },
      {
        date: tomorrow,
        blocks: tomorrowPlan.blocks,
        session: tomorrowSession
          ? { title: tomorrowSession.title, kind: tomorrowSession.kind }
          : null,
        // Tomorrow runs the plan's defaults (today's swaps don't carry over).
        mealDishes: Object.fromEntries(
          food.day.meals.map((m) => [
            m.meal.slot,
            m.groups.map((g) => g.defaultDish.name).join(' + '),
          ]),
        ),
        loggedSlots: new Set(),
        waterMl: 0,
        score: null,
      },
    ];
    return buildSchedule({
      now: t.now,
      days,
      profile: {
        wake_time: hhmm(profile.wake_time),
        phone_off_time: hhmm(profile.phone_off_time),
        water_target_ml: profile.water_target_ml,
        weigh_in_mode: profile.weigh_in_mode,
        weigh_in_weekday: profile.weigh_in_weekday,
      },
      enabled,
      quietDate,
      ...(reviewedWeeks ? { reviewedWeeks } : {}),
    });
  }, [profile, t, food.day.meals, water.totalMl, enabled, quietDate, reviewedWeeks, interruptAt]);
}
