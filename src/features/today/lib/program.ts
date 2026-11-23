import { addDays, type DateString, isoWeekday } from '@/lib/dates';
import type { Change } from '@/features/routine/lib/changes';

export type ProgramDay = { id: string; weekday: number; title: string; kind: string };
export type OverrideRow = {
  client_id: string;
  date: DateString;
  workout_day_id: string;
  deleted_at?: string | null;
};
export type ProgramCtx = {
  program: { start_date: DateString | null } | null;
  days: readonly ProgramDay[];
  overrides: readonly OverrideRow[];
};

/** The workout session a date runs: a moved session (override) or the weekday's. */
export function sessionFor(date: DateString, ctx: ProgramCtx): ProgramDay | null {
  if (!ctx.program || (ctx.program.start_date && date < ctx.program.start_date)) return null;
  const o = ctx.overrides.find((x) => x.date === date && !x.deleted_at);
  if (o) return ctx.days.find((d) => d.id === o.workout_day_id) ?? null;
  return ctx.days.find((d) => d.weekday === isoWeekday(date)) ?? null;
}

/** "Move to tomorrow" is offered for a real session, Monday–Saturday. */
export function canMoveToTomorrow(date: DateString, ctx: ProgramCtx): boolean {
  const s = sessionFor(date, ctx);
  return Boolean(s && s.kind !== 'rest' && isoWeekday(date) < 7);
}

/**
 * DESIGN_NOTES A17: today's session moves to tomorrow and the rest of the week
 * shifts by one day; Sunday (rest) absorbs the shift. Stored as
 * `session_override(date, workout_day_id)` for tomorrow … Sunday.
 */
export function planMoveToTomorrow(date: DateString, ctx: ProgramCtx): Change[] {
  if (!canMoveToTomorrow(date, ctx)) return [];
  const changes: Change[] = [];
  for (let d = addDays(date, 1); isoWeekday(d) !== 1; d = addDays(d, 1)) {
    const from = sessionFor(addDays(d, -1), ctx);
    const current = sessionFor(d, ctx);
    if (!from || from.id === current?.id) continue;
    const existing = ctx.overrides.find((o) => o.date === d);
    changes.push({
      op: 'upsert',
      table: 'session_override',
      ...(existing ? { clientId: existing.client_id } : {}),
      row: { date: d, workout_day_id: from.id, deleted_at: null },
    });
  }
  return changes;
}

const SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** "Upper A moves to Tue, Lower A shifts to Wed". */
export function moveSummary(date: DateString, ctx: ProgramCtx): string {
  const today = sessionFor(date, ctx);
  if (!today) return '';
  const tomorrow = addDays(date, 1);
  const parts = [`${today.title} moves to ${SHORT[isoWeekday(tomorrow) - 1]}`];
  const displaced = sessionFor(tomorrow, ctx);
  if (displaced && displaced.kind !== 'rest' && isoWeekday(tomorrow) < 7)
    parts.push(`${displaced.title} shifts to ${SHORT[isoWeekday(addDays(tomorrow, 1)) - 1]}`);
  return parts.join(', ');
}
