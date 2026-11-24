/**
 * Accountability nudges (PRD F24): pure trigger rules and their limits.
 * Blunt copy, no fluff. Every rule here has a unit test.
 */
import type { Change } from '@/features/routine/lib/changes';
import { addDays, type DateString, daysBetween } from '@/lib/dates';

// ---------------------------------------------------------------------------
// Nudge log (nudge_log rows: what was shown / done, for the limits)
// ---------------------------------------------------------------------------

export type NudgeKind =
  | 'missed_day'
  | 'interrupt'
  | 'pinned'
  | 'fallback'
  | 'rescue_eggs'
  | 'rescue_walk'
  | 'rescue_water'
  | 'rescue_plank'
  | 'reality_weight'
  | 'reality_audit'
  | 'strict_week';

export type NudgeRow = {
  client_id: string;
  date: string;
  kind: string;
  ref: string | null;
  shown_at: string;
  dismissed_at: string | null;
  deleted_at?: string | null;
};

const live = (rows: readonly NudgeRow[]) => rows.filter((r) => !r.deleted_at);
export const nudgesOn = (rows: readonly NudgeRow[], date: DateString, kind: NudgeKind) =>
  live(rows).filter((r) => r.date === date && r.kind === kind);

export function planNudge(
  date: DateString,
  kind: NudgeKind,
  now: number,
  opts: { ref?: string | null; dismissed?: boolean; clientId?: string } = {},
): Change[] {
  return [
    {
      op: 'upsert',
      table: 'nudge_log',
      ...(opts.clientId ? { clientId: opts.clientId } : {}),
      row: {
        date,
        kind,
        ref: opts.ref ?? null,
        shown_at: new Date(now).toISOString(),
        dismissed_at: opts.dismissed ? new Date(now).toISOString() : null,
      },
    },
  ];
}

// ---------------------------------------------------------------------------
// Day rows (a subset of today/selectors DayRow)
// ---------------------------------------------------------------------------

export type NudgeRowInput = {
  block: {
    id: string;
    client_id: string;
    title: string;
    kind: string;
    start_time: string;
    duration_min: number;
    is_optional: boolean;
  };
  state: 'done' | 'skipped' | 'current' | 'due' | 'overdue' | 'upcoming';
  log: { status: string; skip_reason?: string | null } | null;
};

const minOf = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const open = (r: NudgeRowInput) =>
  r.state !== 'done' && r.state !== 'skipped' && !r.block.is_optional;

// ---------------------------------------------------------------------------
// Missed-day recovery (design Acc-Recovery)
// ---------------------------------------------------------------------------

export const STREAK_MIN = 70;

export type RecoveryOption = { clientId: string; title: string; start: string };

/**
 * Yesterday wasn't a streak day → once a day, before it's dismissed or a
 * non-negotiable is locked in. Options: today's blocks that were missed
 * yesterday (same title), then the day's key blocks (workout, water target,
 * the last block), at most 4.
 */
export function recovery(input: {
  enabled: boolean;
  yesterdayScore: number | null;
  missedTitles: readonly string[];
  today: readonly NudgeRowInput[];
  nudges: readonly NudgeRow[];
  date: DateString;
}): { show: boolean; options: RecoveryOption[] } {
  const settled =
    nudgesOn(input.nudges, input.date, 'missed_day').some((n) => n.dismissed_at) ||
    nudgesOn(input.nudges, input.date, 'pinned').length > 0;
  const show =
    input.enabled &&
    input.yesterdayScore !== null &&
    input.yesterdayScore < STREAK_MIN &&
    !settled &&
    input.today.length > 0;
  const missed = new Set(input.missedTitles.map((t) => t.trim().toLowerCase()));
  const rows = input.today.filter((r) => !r.block.is_optional && r.state !== 'done');
  const pick: NudgeRowInput[] = [];
  const add = (r: NudgeRowInput | undefined) => {
    if (r && !pick.includes(r) && pick.length < 4) pick.push(r);
  };
  for (const r of rows) if (missed.has(r.block.title.trim().toLowerCase())) add(r);
  add(rows.find((r) => r.block.kind === 'workout'));
  add([...rows].reverse().find((r) => r.block.kind === 'water'));
  add(rows.at(-1));
  return {
    show,
    options: pick.map((r) => ({
      clientId: r.block.client_id,
      title: r.block.title,
      start: r.block.start_time,
    })),
  };
}

/** The pinned block for today (latest pin wins). */
export const pinnedFor = (nudges: readonly NudgeRow[], date: DateString) =>
  nudgesOn(nudges, date, 'pinned').at(-1)?.ref ?? null;

// ---------------------------------------------------------------------------
// Failure interrupt (design Acc-Interrupt, DESIGN_NOTES A8)
// ---------------------------------------------------------------------------

export const INTERRUPT_OVERDUE = 3;
export const INTERRUPT_MAX = 3;
export const SNOOZE_MIN = 15;

/** Counted blocks whose time has passed without being done or skipped. */
export const overdueRows = (rows: readonly NudgeRowInput[]) =>
  rows.filter((r) => open(r) && (r.state === 'due' || r.state === 'overdue'));

/** The one thing to do now: a water drink first (one tap logs it), else the shortest open block. */
export function easiest(rows: readonly NudgeRowInput[]): NudgeRowInput | null {
  const candidates = rows.filter((r) => open(r) && r.state !== 'upcoming');
  return (
    candidates.find((r) => r.block.kind === 'water') ??
    [...candidates].sort(
      (a, b) =>
        a.block.duration_min - b.block.duration_min ||
        minOf(a.block.start_time) - minOf(b.block.start_time),
    )[0] ??
    null
  );
}

export function interrupt(input: {
  enabled: boolean;
  rows: readonly NudgeRowInput[];
  nudges: readonly NudgeRow[];
  date: DateString;
  now: number;
  snoozedUntil: number | null;
}): {
  show: boolean;
  overdue: number;
  target: NudgeRowInput | null;
  shownToday: number;
  isNew: boolean;
} {
  const overdue = overdueRows(input.rows).length;
  const shown = nudgesOn(input.nudges, input.date, 'interrupt');
  const active = shown.find((n) => !n.dismissed_at);
  const target = easiest(input.rows);
  const snoozed = input.snoozedUntil !== null && input.now < input.snoozedUntil;
  const allowed = active ? true : shown.length < INTERRUPT_MAX;
  const show = input.enabled && overdue >= INTERRUPT_OVERDUE && !!target && !snoozed && allowed;
  return { show, overdue, target, shownToday: shown.length, isNew: show && !active };
}

/**
 * When to notify (F15 schedule): the first block start from now where, if
 * nothing more gets done, ≥ 3 counted blocks would be overdue. null when the
 * day's limit is used, it's off, or it never gets there.
 */
export function nextInterruptAt(input: {
  enabled: boolean;
  rows: readonly NudgeRowInput[];
  nowMin: number;
  shownToday: number;
  snoozedUntilMin: number | null;
}): number | null {
  if (!input.enabled || input.shownToday >= INTERRUPT_MAX) return null;
  const pending = input.rows.filter(open);
  const starts = [...new Set(input.rows.map((r) => minOf(r.block.start_time)))]
    .filter(
      (m) => m > input.nowMin && (input.snoozedUntilMin === null || m >= input.snoozedUntilMin),
    )
    .sort((a, b) => a - b);
  for (const t of starts) {
    const n = pending.filter((r) => minOf(r.block.start_time) + r.block.duration_min <= t).length;
    if (n >= INTERRUPT_OVERDUE) return t;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Fallback mode (design Acc-Fallback, DESIGN_NOTES A9)
// ---------------------------------------------------------------------------

export const FALLBACK_FROM_MIN = 18 * 60;
export const FALLBACK_BELOW = 50;
export const GRACE_MIN = 50;

export type Rescue = 'rescue_eggs' | 'rescue_walk' | 'rescue_water' | 'rescue_plank';
export const RESCUES: readonly { kind: Rescue; title: string; sub: string }[] = [
  { kind: 'rescue_eggs', title: '2 boiled eggs', sub: '+12 g protein' },
  { kind: 'rescue_walk', title: 'Walk 1,000 steps', sub: '~10 min' },
  { kind: 'rescue_water', title: 'Drink 500 ml', sub: 'logs 500 ml' },
  { kind: 'rescue_plank', title: '30-s plank', sub: 'right here' },
];
export const EGGS = { kcal: 140, protein: 12 };

/** Score with rescue actions counted as extra done blocks (each adds one to both sides). */
export function withRescues(done: number, counted: number, rescues: number): number {
  const d = done + rescues;
  const c = counted + rescues;
  return c === 0 ? 100 : Math.round((d / c) * 100);
}

export function fallback(input: {
  enabled: boolean;
  nowMin: number;
  done: number;
  counted: number;
  nudges: readonly NudgeRow[];
  date: DateString;
  graceAvailable: boolean;
}): {
  show: boolean;
  score: number;
  actions: { kind: Rescue; title: string; sub: string; done: boolean; gain: number }[];
  allTo: number;
  saves: 'streak' | 'grace' | 'no';
} {
  const doneKinds = new Set(
    live(input.nudges)
      .filter((n) => n.date === input.date && n.kind.startsWith('rescue_'))
      .map((n) => n.kind),
  );
  const r = doneKinds.size;
  const score = withRescues(input.done, input.counted, r);
  const base = withRescues(input.done, input.counted, 0);
  const show =
    input.enabled &&
    input.nowMin >= FALLBACK_FROM_MIN &&
    (base < FALLBACK_BELOW || r > 0) &&
    input.counted > 0;
  const remaining = RESCUES.filter((x) => !doneKinds.has(x.kind)).length;
  const allTo = withRescues(input.done, input.counted, r + remaining);
  return {
    show,
    score,
    actions: RESCUES.map((x) => ({
      ...x,
      done: doneKinds.has(x.kind),
      gain: doneKinds.has(x.kind) ? 0 : withRescues(input.done, input.counted, r + 1) - score,
    })),
    allTo,
    saves:
      allTo >= STREAK_MIN ? 'streak' : allTo >= GRACE_MIN && input.graceAvailable ? 'grace' : 'no',
  };
}

export const rescuesOn = (nudges: readonly NudgeRow[], date: DateString) =>
  new Set(
    live(nudges)
      .filter((n) => n.date === date && n.kind.startsWith('rescue_'))
      .map((n) => n.kind),
  ).size;

// ---------------------------------------------------------------------------
// Reality check (design Acc-Reality, DESIGN_NOTES A10)
// ---------------------------------------------------------------------------

export const REALITY_GAIN_KG = 0.4;
export const REALITY_SCORE = 75;
export const REALITY_DEFICIT = 300;
export const ONCE_PER_DAYS = 7;
export const STRICT_DAYS = 7;

/** Acted on (dismissed) in the last 7 days → quiet. */
const recentlyActed = (nudges: readonly NudgeRow[], kind: NudgeKind, today: DateString) =>
  live(nudges).some(
    (n) => n.kind === kind && n.dismissed_at && daysBetween(n.date, today) < ONCE_PER_DAYS,
  );

export function realityWeight(input: {
  enabled: boolean;
  today: DateString;
  /** 7-day averages by date (ascending). */
  avg7: readonly { date: DateString; avg7: number }[];
  scores: readonly { date: DateString; score: number | null }[];
  /** kcal eaten per logged day. */
  intake: ReadonlyMap<DateString, number>;
  tdee: number;
  nudges: readonly NudgeRow[];
}): {
  show: boolean;
  days: number;
  from: number;
  to: number;
  gain: number;
  avgScore: number;
  deficit: number;
} | null {
  const latest = [...input.avg7].reverse().find((p) => daysBetween(p.date, input.today) <= 1);
  if (!latest) return null;
  // The comparison point 10–14 days earlier (earliest in that window).
  const past = input.avg7.find((p) => {
    const d = daysBetween(p.date, latest.date);
    return d >= 10 && d <= 14;
  });
  if (!past) return null;
  const days = daysBetween(past.date, latest.date);
  const gain = Math.round((latest.avg7 - past.avg7) * 10) / 10;
  const window = input.scores.filter(
    (s) => s.date > past.date && s.date <= latest.date && s.score !== null,
  );
  const avgScore = window.length
    ? Math.round(window.reduce((a, s) => a + (s.score as number), 0) / window.length)
    : 0;
  const eaten = [...input.intake].filter(([d]) => d > past.date && d < input.today);
  const deficit = eaten.length
    ? Math.round(input.tdee - eaten.reduce((a, [, k]) => a + k, 0) / eaten.length)
    : 0;
  const triggered =
    gain >= REALITY_GAIN_KG && avgScore >= REALITY_SCORE && deficit >= REALITY_DEFICIT;
  const show =
    input.enabled && triggered && !recentlyActed(input.nudges, 'reality_weight', input.today);
  return { show, days, from: past.avg7, to: latest.avg7, gain, avgScore, deficit };
}

/** (b) 7 straight days at 100 % (yesterday back) → "Audit day"; once per 7 days. */
export function auditDay(input: {
  enabled: boolean;
  today: DateString;
  scores: readonly { date: DateString; score: number | null }[];
  nudges: readonly NudgeRow[];
}): boolean {
  if (!input.enabled || recentlyActed(input.nudges, 'reality_audit', input.today)) return false;
  for (let i = 1; i <= 7; i++) {
    const d = addDays(input.today, -i);
    if (input.scores.find((s) => s.date === d)?.score !== 100) return false;
  }
  return true;
}

/** "Strict week": 7 days from the day it was chosen, showing "weigh it" on meals. */
export const strictWeek = (nudges: readonly NudgeRow[], today: DateString) =>
  live(nudges).some(
    (n) =>
      n.kind === 'strict_week' &&
      daysBetween(n.date, today) >= 0 &&
      daysBetween(n.date, today) < STRICT_DAYS,
  );
