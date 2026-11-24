import type { Change } from '@/features/routine/lib/changes';
import { addDays, type DateString, isoWeekday, weekStart } from '@/lib/dates';

/** PRD F20: Sunday 20:00. */
export const REVIEW_WEEKDAY = 7;
export const REVIEW_TIME = '20:00';
export const TEXT_MAX = 280;

/**
 * The week a review covers: on Sunday, this week (Mon–Sun ending today);
 * any other day, last week.
 */
export function reviewWeek(today: DateString): DateString {
  return isoWeekday(today) === REVIEW_WEEKDAY ? weekStart(today) : addDays(weekStart(today), -7);
}

export type Grade = 'Excellent' | 'Good' | 'OK' | 'Needs work';

/** DESIGN_NOTES A5 / PRD F24: ≥ 90 Excellent · 80–89 Good · 70–79 OK · < 70 Needs work. */
export function gradeFor(score: number | null): { grade: Grade; band: string } | null {
  if (score === null) return null;
  if (score >= 90) return { grade: 'Excellent', band: '90%+' };
  if (score >= 80) return { grade: 'Good', band: '80–89%' };
  if (score >= 70) return { grade: 'OK', band: '70–79%' };
  return { grade: 'Needs work', band: 'under 70%' };
}

/** One `v_weekly_rollup` row (numbers arrive as numbers or numeric strings). */
export type RollupRow = {
  week_start: string | null;
  avg_score: number | null;
  streak_days: number | null;
  sessions: number | null;
  avg_protein: number | string | null;
  avg_kcal: number | null;
  weight_change: number | string | null;
  avg_sleep_hours: number | string | null;
  spend_inr: number | string | null;
};

export type Summary = {
  avgScore: number | null;
  prevScore: number | null;
  streakDays: number;
  sessions: number;
  avgProtein: number | null;
  avgKcal: number | null;
  weightChange: number | null;
  avgSleep: number | null;
  spend: number;
  worst: WorstBlock | null;
};

const num = (v: number | string | null | undefined): number | null =>
  v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v);

/** The week's summary from the view (this week's row and last week's for the score change). */
export function summaryFrom(
  rows: readonly RollupRow[],
  week: DateString,
  worst: WorstBlock | null,
): Summary {
  const r = rows.find((x) => x.week_start === week);
  const prev = rows.find((x) => x.week_start === addDays(week, -7));
  const w = num(r?.weight_change);
  return {
    avgScore: num(r?.avg_score),
    prevScore: num(prev?.avg_score),
    streakDays: num(r?.streak_days) ?? 0,
    sessions: num(r?.sessions) ?? 0,
    avgProtein: num(r?.avg_protein),
    avgKcal: num(r?.avg_kcal),
    weightChange: w === null ? null : Math.round(w * 10) / 10,
    avgSleep: num(r?.avg_sleep_hours),
    spend: num(r?.spend_inr) ?? 0,
    worst,
  };
}

export type PlannedDay = {
  date: DateString;
  /** The day's counted blocks (non-optional) that must be ticked by hand. */
  blocks: readonly { id: string; title: string; start_time: string; auto_complete: boolean }[];
};

export type WorstBlock = {
  title: string;
  startTime: string;
  done: number;
  scheduled: number;
  pct: number;
  missed: DateString[];
};

/**
 * The block with the lowest completion % over the week's days so far
 * (ticked ÷ scheduled). Blocks are matched by title across templates;
 * auto-completed blocks (water, meals, workout) are left out because their
 * "done" comes from logs, not ticks. Ties → more scheduled days, then earlier.
 */
export function worstBlock(
  days: readonly PlannedDay[],
  done: ReadonlySet<string>,
): WorstBlock | null {
  const by = new Map<string, WorstBlock>();
  for (const d of days)
    for (const b of d.blocks) {
      if (b.auto_complete) continue;
      const key = b.title.trim().toLowerCase();
      const w = by.get(key) ?? {
        title: b.title,
        startTime: b.start_time,
        done: 0,
        scheduled: 0,
        pct: 0,
        missed: [],
      };
      w.scheduled += 1;
      if (done.has(`${d.date}:${b.id}`)) w.done += 1;
      else w.missed.push(d.date);
      by.set(key, w);
    }
  const all = [...by.values()].map((w) => ({
    ...w,
    pct: Math.round((w.done / w.scheduled) * 100),
  }));
  const worst = all
    .filter((w) => w.done < w.scheduled)
    .sort(
      (a, b) =>
        a.pct - b.pct || b.scheduled - a.scheduled || a.startTime.localeCompare(b.startTime),
    );
  return worst[0] ?? null;
}

/** The week's days that have started (all 7 on Sunday night). */
export function weekDays(week: DateString, today: DateString): DateString[] {
  return Array.from({ length: 7 }, (_, i) => addDays(week, i)).filter((d) => d <= today);
}

export type ReviewRow = {
  client_id: string;
  week_start: string;
  went_well: string | null;
  change_next_week: string | null;
  grade: string | null;
  summary: unknown;
  deleted_at?: string | null;
};

/** One review per week (unique): reuse the week's row, revive it if deleted. */
export function planReview(
  week: DateString,
  existing: Pick<ReviewRow, 'client_id'> | null,
  summary: Summary,
  wentWell: string,
  change: string,
): Change[] {
  return [
    {
      op: 'upsert',
      table: 'weekly_review',
      ...(existing ? { clientId: existing.client_id } : {}),
      row: {
        week_start: week,
        summary,
        grade: gradeFor(summary.avgScore)?.grade ?? null,
        went_well: wentWell.trim().slice(0, TEXT_MAX) || null,
        change_next_week: change.trim().slice(0, TEXT_MAX) || null,
        deleted_at: null,
      },
    },
  ];
}

/**
 * The change Today pins this week: from the review of the week before
 * (saved on Sunday), shown Monday through Sunday until the next review.
 */
export function pinnedChange(
  reviews: readonly ReviewRow[],
  today: DateString,
): { text: string; review: ReviewRow } | null {
  const last = reviews.find((r) => !r.deleted_at && r.week_start === addDays(weekStart(today), -7));
  return last?.change_next_week ? { text: last.change_next_week, review: last } : null;
}

/** Week number of the year (ISO-ish: weeks since the first Monday on/before 1 Jan). */
export function weekLabel(week: DateString): string {
  const jan1 = `${week.slice(0, 4)}-01-01`;
  const n = Math.floor((Date.parse(week) - Date.parse(weekStart(jan1))) / (7 * 864e5)) + 1;
  return `Week ${n}`;
}

/** One-tap starters for "What I change next week" (Review-2 design chips). */
export function changeIdeas(
  s: Summary,
  targets: { proteinG: number; sleepH: number; phoneOff: string },
): string[] {
  const out: string[] = [];
  if (s.worst) out.push(`${s.worst.title} every day`);
  if (s.avgSleep !== null && s.avgSleep < targets.sleepH)
    out.push(`Phone in the hall at ${targets.phoneOff}`);
  if (s.avgProtein !== null && s.avgProtein < targets.proteinG) out.push('Protein at every meal');
  if (out.length < 2) out.push('Same plan, no skips');
  return out.slice(0, 3);
}
