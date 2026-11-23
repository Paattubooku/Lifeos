import { type DateString, logicalMoment } from '@/lib/dates';

import { type BlockLike, blocksOf, countedBlocks, hhmm } from './blocks';
import { resolveTemplate, type TemplateLike } from './templates';

export type DayPlan<T, B> = {
  date: DateString;
  template: T | null;
  /** Timeline order. */
  blocks: B[];
  /** The day score's denominator before skips (PRD §4.2, A19). */
  counted: B[];
  /** true when the template came from a manual switch stored on day_log. */
  switched: boolean;
};

/**
 * What a date runs: its template (manual switch, else weekday rule) and that
 * template's blocks as they are now. Past days' block_logs are separate rows
 * (status, done_at), so editing a template never rewrites them (F04 AC1).
 */
export function planForDate<T extends TemplateLike, B extends BlockLike>(
  date: DateString,
  templates: readonly T[],
  blocks: readonly B[],
  dayLog?: { template_id?: string | null; deleted_at?: string | null } | null,
): DayPlan<T, B> {
  const template = resolveTemplate(templates, date, dayLog);
  const list = template ? blocksOf(blocks, template.id) : [];
  return {
    date,
    template,
    blocks: list,
    counted: countedBlocks(list),
    switched: Boolean(
      dayLog && !dayLog.deleted_at && dayLog.template_id && template?.id === dayLog.template_id,
    ),
  };
}

export type PlannedReminder = { blockClientId: string; title: string; at: number };

/** Block-start reminders for a date's plan (F15 schedules these). */
export function remindersFor(plan: DayPlan<unknown, BlockLike>): PlannedReminder[] {
  return plan.blocks
    .filter((b) => b.notify)
    .map((b) => ({
      blockClientId: b.client_id,
      title: b.title,
      at: logicalMoment(plan.date, hhmm(b.start_time)),
    }));
}
