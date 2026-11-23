import type { BlockLike } from '@/features/routine/lib/blocks';
import type { Change } from '@/features/routine/lib/changes';
import { planForDate } from '@/features/routine/lib/day';
import type { TemplateLike } from '@/features/routine/lib/templates';
import { addDays, type DateString } from '@/lib/dates';

import { type BlockLogLike, buildDay } from '../selectors';
import { eatenSlots, type FoodLike, type MealPlanLike } from './meals';
import { type ProgramCtx, sessionFor } from './program';
import { isStreakDay } from './streak';

export type DayLogScoreRow = {
  client_id: string;
  date: DateString;
  score: number | null;
  is_streak_day: boolean | null;
  template_id: string | null;
  deleted_at?: string | null;
};

/** After every block of the day (02:59 next morning). */
const END_OF_DAY_MIN = 1620;

export type DateLogs = {
  blockLogs: readonly (BlockLogLike & { date: DateString })[];
  water: readonly { date: DateString; amount_ml: number; logged_at: string }[];
  food: readonly (FoodLike & { date: DateString })[];
  sessions: readonly { date: DateString; completion: number | null }[];
};

/** A finished day's score from its plan and that day's logs (PRD §4.2). */
export function scoreForDate(
  date: DateString,
  ctx: {
    templates: readonly TemplateLike[];
    blocks: readonly BlockLike[];
    dayLog: { template_id?: string | null; deleted_at?: string | null } | null;
    logs: DateLogs;
    mealPlan: MealPlanLike;
    program: ProgramCtx;
    waterTargetMl: number;
  },
): { score: number; templateId: string | null } {
  const plan = planForDate(date, ctx.templates, ctx.blocks, ctx.dayLog);
  const session = sessionFor(date, ctx.program);
  const completion = ctx.logs.sessions.find((s) => s.date === date)?.completion ?? null;
  const day = buildDay(
    plan.blocks,
    ctx.logs.blockLogs.filter((l) => l.date === date),
    {
      water: ctx.logs.water.filter((w) => w.date === date),
      waterTargetMl: ctx.waterTargetMl,
      eatenSlots: eatenSlots(
        ctx.logs.food.filter((f) => f.date === date),
        ctx.mealPlan,
      ),
      session: session ? { kind: session.kind, completion } : null,
    },
    END_OF_DAY_MIN,
  );
  return { score: day.score.score, templateId: plan.template?.id ?? null };
}

/**
 * Upsert `day_log.score` / `is_streak_day` when they changed. Reuses (or
 * revives) the day's row; keeps a manual template switch already on it.
 */
export function planDayScore(
  date: DateString,
  dayLog: (Partial<DayLogScoreRow> & { client_id: string }) | null,
  score: number,
  templateId: string | null,
): Change[] {
  const streak = isStreakDay(score);
  if (dayLog && !dayLog.deleted_at && dayLog.score === score && dayLog.is_streak_day === streak)
    return [];
  return [
    {
      op: 'upsert',
      table: 'day_log',
      ...(dayLog ? { clientId: dayLog.client_id } : {}),
      row: {
        date,
        score,
        is_streak_day: streak,
        deleted_at: null,
        ...(dayLog?.template_id || !templateId ? {} : { template_id: templateId }),
      },
    },
  ];
}

/**
 * Past days to finalise on app open: any of the last 8 days whose day_log has
 * no score, and yesterday if it has no day_log at all. A day that already has
 * a score keeps it (it was kept live from that day's logs; re-scoring with
 * today's template would rewrite the past). Never before the first day_log.
 */
export function datesToFinalise(
  today: DateString,
  dayLogs: readonly DayLogScoreRow[],
): DateString[] {
  const live = dayLogs.filter((d) => !d.deleted_at);
  const first = live.map((d) => d.date).sort()[0];
  if (!first) return [];
  const yesterday = addDays(today, -1);
  const out = new Set<DateString>();
  for (let i = 8; i >= 1; i--) {
    const d = addDays(today, -i);
    if (live.some((x) => x.date === d && x.score === null)) out.add(d);
  }
  if (yesterday >= first && !live.some((x) => x.date === yesterday)) out.add(yesterday);
  return [...out].sort();
}
