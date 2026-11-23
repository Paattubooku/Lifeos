import { blockMeta, hhmm } from '@/features/routine/lib/blocks';
import { istClock } from '@/lib/dates';
import { formatClock } from '@/lib/format';

import type { DayRow } from '../selectors';
import type { MealSummary } from './meals';
import { endOf, formatMinutes } from './timeline';

export type RowContext = {
  nowMin: number;
  /** Today's program session, if the program runs today. */
  session: { title: string; kind: string } | null;
  exercises: readonly string[];
  meal: (slot: string | null) => MealSummary | null;
};

export type RowText = { title: string; sub: string; late: boolean; pill: 'now' | 'next' | null };

const REASON: Record<string, string> = {
  sick: 'sick',
  travel: 'travel',
  rest: 'rest',
  other: 'other',
};

/** "Workout · Upper A" when the block is the generic workout block. */
export function rowTitle(row: Pick<DayRow, 'block'>, session: RowContext['session']): string {
  const b = row.block;
  if (
    b.kind === 'workout' &&
    session &&
    session.kind !== 'rest' &&
    !b.title.includes(session.title)
  )
    return `${b.title} · ${session.title}`;
  return b.title;
}

/** Second line of a timeline row by state and kind (Today designs). */
export function rowText(row: DayRow, ctx: RowContext, isNext: boolean): RowText {
  const b = row.block;
  const title = rowTitle(row, ctx.session);
  const base = (): string => {
    if (b.kind === 'meal') {
      const m = ctx.meal(b.ref_slot);
      if (m) return `${m.names.join(', ')} · ${m.kcal} kcal`;
    }
    if (b.kind === 'workout' && ctx.session) {
      if (ctx.session.kind === 'rest') return 'Rest day — nothing to do';
      const n = ctx.exercises.length;
      return n > 0
        ? `${n} exercise${n === 1 ? '' : 's'} · ${b.duration_min} min`
        : `${b.duration_min} min`;
    }
    if (row.auto.hint && b.kind === 'water') return row.auto.hint;
    if (b.is_optional)
      return `Optional · ${b.duration_min > 0 ? `${b.duration_min} min` : 'not counted'}`;
    return blockMeta(b);
  };

  switch (row.state) {
    case 'done': {
      if (row.log?.status === 'done' && row.log.done_at)
        return {
          title,
          sub: `Done at ${formatClock(istClock(row.log.done_at))}`,
          late: false,
          pill: null,
        };
      return {
        title,
        sub: row.auto.hint && b.kind === 'water' ? row.auto.hint : base(),
        late: false,
        pill: null,
      };
    }
    case 'skipped':
      return {
        title,
        sub: `Skipped${row.log?.skip_reason ? ` · ${REASON[row.log.skip_reason] ?? row.log.skip_reason}` : ''}`,
        late: false,
        pill: null,
      };
    case 'current':
      return {
        title,
        sub: `${base()} · ${formatMinutes(endOf(b) - ctx.nowMin)} left`,
        late: false,
        pill: 'now',
      };
    case 'overdue':
    case 'due': {
      const late = ctx.nowMin - endOf(b);
      return {
        title,
        sub: `${base()} · ${formatMinutes(late)} late`,
        late: row.state === 'overdue',
        pill: null,
      };
    }
    default:
      return { title, sub: base(), late: false, pill: isNext ? 'next' : null };
  }
}

/** "5:00" + "AM" for the time column. */
export function timeParts(start: string): { time: string; period: string } {
  const [time, period] = formatClock(hhmm(start)).split(' ') as [string, string];
  return { time, period: period.toUpperCase() };
}

const DOW = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

/** "MON 23 NOV · 5 OF 11 DONE". */
export function dayKicker(date: string, isoWeekday: number, done: number, counted: number): string {
  const [, m, d] = date.split('-').map(Number) as [number, number, number];
  return `${DOW[isoWeekday - 1]} ${d} ${MON[m - 1]} · ${done} OF ${counted} DONE`;
}
