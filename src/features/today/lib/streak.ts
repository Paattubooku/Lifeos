import { addDays, type DateString, daysBetween } from '@/lib/dates';

/** PRD §4.2: ≥ 70 streak day · 50–69 grace-eligible · < 50 (or no day_log) breaks. */
export const STREAK_MIN = 70;
export const GRACE_MIN = 50;
/** A grace day is allowed if the last one was ≥ 15 days before (none in the previous 14). */
export const GRACE_GAP_DAYS = 15;

export type DayClass = 'streak' | 'grace' | 'break';

export function classifyScore(score: number | null | undefined): DayClass {
  if (score === null || score === undefined) return 'break';
  if (score >= STREAK_MIN) return 'streak';
  if (score >= GRACE_MIN) return 'grace';
  return 'break';
}

export const isStreakDay = (score: number | null | undefined) => classifyScore(score) === 'streak';

export type DayScore = { date: DateString; score: number | null; deleted_at?: string | null };

export type Run = { length: number; from: DateString; to: DateString };

export type StreakResult = {
  current: number;
  /** Start of the current run, if any. */
  since: DateString | null;
  best: Run | null;
  /** Grace days that kept a run alive, oldest first. */
  graceDays: DateString[];
  lastGrace: DateString | null;
  /** Could a 50–69 day today still be saved by grace? */
  graceAvailable: boolean;
};

/**
 * PRD §4.3. Walks every day from the first day_log to yesterday; a missing
 * day breaks. A grace-eligible day continues an existing run if no grace was
 * used in the previous 14 days; it never starts a run. Today only adds (≥ 70)
 * and never breaks — it isn't over yet.
 */
export function computeStreak(
  days: readonly DayScore[],
  today: DateString,
  todayScore: number | null,
): StreakResult {
  const byDate = new Map<DateString, number | null>();
  for (const d of days) if (!d.deleted_at && d.date < today) byDate.set(d.date, d.score);
  const first = [...byDate.keys()].sort()[0];

  let run = 0;
  let since: DateString | null = null;
  let best: Run | null = null;
  let lastGrace: DateString | null = null;
  const graceDays: DateString[] = [];

  const extend = (date: DateString) => {
    run += 1;
    if (run === 1) since = date;
    if (!best || run > best.length) best = { length: run, from: since as DateString, to: date };
  };

  if (first) {
    for (let d = first; d < today; d = addDays(d, 1)) {
      const kind = classifyScore(byDate.get(d));
      if (kind === 'streak') extend(d);
      else if (
        kind === 'grace' &&
        run > 0 &&
        (!lastGrace || daysBetween(lastGrace, d) >= GRACE_GAP_DAYS)
      ) {
        lastGrace = d;
        graceDays.push(d);
        extend(d);
      } else {
        run = 0;
        since = null;
      }
    }
  }
  if (classifyScore(todayScore) === 'streak') extend(today);

  return {
    current: run,
    since: run > 0 ? since : null,
    best,
    graceDays,
    lastGrace,
    graceAvailable: !lastGrace || daysBetween(lastGrace, today) >= GRACE_GAP_DAYS,
  };
}

/** "12-day streak · 1 grace left" / "12-day streak · grace used Sun 20 Dec". */
export function streakLine(s: StreakResult, formatDay: (d: DateString) => string): string {
  const head = s.current === 1 ? '1-day streak' : `${s.current}-day streak`;
  const grace = s.graceAvailable
    ? '1 grace left'
    : `grace used ${formatDay(s.lastGrace as DateString)}`;
  return `${head} · ${grace}`;
}

export type HeatBand = 'none' | 'lt50' | '50to69' | '70to79' | '80to89' | '90plus';

export function heatBand(score: number | null | undefined): HeatBand {
  if (score === null || score === undefined) return 'none';
  if (score < 50) return 'lt50';
  if (score < 70) return '50to69';
  if (score < 80) return '70to79';
  if (score < 90) return '80to89';
  return '90plus';
}

export type HeatCell = {
  date: DateString;
  score: number | null;
  band: HeatBand;
  grace: boolean;
  today: boolean;
};

/** The last `n` days ending today (today uses the live score). */
export function heatmap(
  days: readonly DayScore[],
  today: DateString,
  todayScore: number | null,
  graceDays: readonly DateString[],
  n = 30,
): HeatCell[] {
  const byDate = new Map(days.filter((d) => !d.deleted_at).map((d) => [d.date, d.score]));
  const grace = new Set(graceDays);
  return Array.from({ length: n }, (_, i) => {
    const date = addDays(today, i - n + 1);
    const score = date === today ? todayScore : (byDate.get(date) ?? null);
    return { date, score, band: heatBand(score), grace: grace.has(date), today: date === today };
  });
}

/** Average of the scored days among the cells (null when none). */
export function averageScore(cells: readonly { score: number | null }[]): number | null {
  const scored = cells.filter((c) => c.score !== null);
  if (scored.length === 0) return null;
  return Math.round(scored.reduce((s, c) => s + (c.score as number), 0) / scored.length);
}

/** The most recent day that broke a run (scored < 50, or a grace day refused). */
export function lastBreak(days: readonly DayScore[], today: DateString): DayScore | null {
  const past = days.filter((d) => !d.deleted_at && d.date < today && d.score !== null);
  const sorted = [...past].sort((a, b) => b.date.localeCompare(a.date));
  return sorted.find((d) => classifyScore(d.score) === 'break') ?? null;
}

/**
 * Per-block streak ("Wake: 12 days"): consecutive days ending yesterday — or
 * today once it's done — on which the block was ticked.
 */
export function blockStreak(doneDates: ReadonlySet<DateString>, today: DateString): number {
  let n = 0;
  let d = doneDates.has(today) ? today : addDays(today, -1);
  while (doneDates.has(d)) {
    n += 1;
    d = addDays(d, -1);
  }
  return n;
}
