import { type ProgramCtx, sessionFor } from '@/features/today/lib/program';
import { addDays, type DateString, weekStart } from '@/lib/dates';

import type { SessionRow } from './session';

/** A session counts as done at the same 80 % that ticks Today's workout block. */
export const DONE_PCT = 80;

export type DayState = 'done' | 'missed' | 'rest' | 'today' | 'upcoming' | 'none';
export type WeekDay = { date: DateString; title: string; kind: string | null; state: DayState };

function stateOf(
  date: DateString,
  today: DateString,
  kind: string | null,
  session: SessionRow | undefined,
): DayState {
  if (!kind) return 'none';
  if (kind === 'rest') return 'rest';
  if ((session?.completion ?? 0) >= DONE_PCT) return 'done';
  if (date === today) return 'today';
  return date < today ? 'missed' : 'upcoming';
}

function day(
  date: DateString,
  today: DateString,
  ctx: ProgramCtx,
  sessions: readonly SessionRow[],
): WeekDay {
  const s = sessionFor(date, ctx);
  const log = sessions.find((x) => x.date === date && !x.deleted_at);
  return {
    date,
    title: s?.title ?? '—',
    kind: s?.kind ?? null,
    state: stateOf(date, today, s?.kind ?? null, log),
  };
}

/** The 7 days ending today (Train tab "Last 7 days"). */
export function lastSevenDays(
  today: DateString,
  ctx: ProgramCtx,
  sessions: readonly SessionRow[],
): WeekDay[] {
  return Array.from({ length: 7 }, (_, i) => day(addDays(today, i - 6), today, ctx, sessions));
}

/** Monday–Sunday of this week (walk-day design "This week"). */
export function thisWeek(
  today: DateString,
  ctx: ProgramCtx,
  sessions: readonly SessionRow[],
): WeekDay[] {
  const mon = weekStart(today);
  return Array.from({ length: 7 }, (_, i) => day(addDays(mon, i), today, ctx, sessions));
}

/** "4 of 5 sessions · Thu missed" (rest days don't count). */
export function weekSummary(days: readonly WeekDay[]): {
  done: number;
  planned: number;
  missed: WeekDay[];
} {
  const training = days.filter((d) => d.kind && d.kind !== 'rest');
  return {
    done: training.filter((d) => d.state === 'done').length,
    planned: training.length,
    missed: training.filter((d) => d.state === 'missed'),
  };
}
