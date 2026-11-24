/**
 * Home-screen widget summary (PRD F22): what `widget-summary` returns.
 * Pure and dependency-free; byte-identical to
 * `supabase/functions/_shared/summary.ts` (a test checks). The streak,
 * template and water-pace rules are ports of the app's (tests compare them).
 */

const DAY_MS = 86_400_000;
const IST_MIN = 330;
const DAY_START_MIN = 180;

export const addDays = (d: string, n: number) =>
  // eslint-disable-next-line no-restricted-syntax -- UTC date maths on a YYYY-MM-DD string
  new Date(Date.parse(`${d}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
export const daysBetween = (a: string, b: string) =>
  Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY_MS);
const isoWeekday = (d: string) => {
  const w = new Date(`${d}T00:00:00Z`).getUTCDay();
  return w === 0 ? 7 : w;
};
/** IST logical day (starts 03:00) and minutes since IST midnight. */
export function istNow(ms: number): { today: string; minutes: number } {
  const shifted = new Date(ms + (IST_MIN - DAY_START_MIN) * 60_000);
  const ist = new Date(ms + IST_MIN * 60_000);
  return {
    // eslint-disable-next-line no-restricted-syntax -- shifted to the IST logical day first
    today: shifted.toISOString().slice(0, 10),
    minutes: ist.getUTCHours() * 60 + ist.getUTCMinutes(),
  };
}
const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
/** Minutes on the logical-day axis: 00:00–02:59 come after 23:59. */
const dayMin = (m: number) => (m < DAY_START_MIN ? m + 1440 : m);

// ---------------------------------------------------------------------------
// Streak (port of today/lib/streak computeStreak, current run only)
// ---------------------------------------------------------------------------

type Kind = 'streak' | 'grace' | 'break';
const kindOf = (s: number | null | undefined): Kind =>
  s === null || s === undefined ? 'break' : s >= 70 ? 'streak' : s >= 50 ? 'grace' : 'break';

export function currentStreak(
  days: readonly { date: string; score: number | null; deleted_at?: string | null }[],
  today: string,
  todayScore: number | null,
): number {
  const by = new Map<string, number | null>();
  for (const d of days) if (!d.deleted_at && d.date < today) by.set(d.date, d.score);
  const first = [...by.keys()].sort()[0];
  let run = 0;
  let lastGrace: string | null = null;
  if (first)
    for (let d = first; d < today; d = addDays(d, 1)) {
      const k = kindOf(by.get(d));
      if (k === 'streak') run += 1;
      else if (k === 'grace' && run > 0 && (!lastGrace || daysBetween(lastGrace, d) >= 15)) {
        lastGrace = d;
        run += 1;
      } else run = 0;
    }
  if (kindOf(todayScore) === 'streak') run += 1;
  return run;
}

// ---------------------------------------------------------------------------
// Today's plan (port of routine/lib/templates resolveTemplate)
// ---------------------------------------------------------------------------

export type TemplateLike = {
  id: string;
  weekdays: number[];
  is_default: boolean;
  archived_at: string | null;
  deleted_at: string | null;
  updated_at: string;
};
export type BlockLike = {
  id: string;
  template_id: string;
  title: string;
  kind: string;
  start_time: string;
  duration_min: number;
  deleted_at: string | null;
};

export function templateFor<T extends TemplateLike>(
  templates: readonly T[],
  date: string,
  manualId: string | null,
): T | null {
  const chosen = manualId ? templates.find((t) => t.id === manualId && !t.deleted_at) : undefined;
  if (chosen) return chosen;
  const live = templates.filter((t) => !t.deleted_at && !t.archived_at);
  const claiming = live
    .filter((t) => t.weekdays.includes(isoWeekday(date)))
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  return claiming[0] ?? live.find((t) => t.is_default) ?? null;
}

export type BlockSlot = { title: string; start: string; end: string; kind: string };

/**
 * The block running now (not ticked or skipped) and the next open one.
 * Blocks that started earlier and were never ticked count as passed.
 */
export function nowAndNext(
  blocks: readonly BlockLike[],
  logged: ReadonlySet<string>,
  minutes: number,
): { now: BlockSlot | null; next: BlockSlot | null; after: BlockSlot | null } {
  const t = dayMin(minutes);
  const open = blocks
    .filter((b) => !b.deleted_at && !logged.has(b.id))
    .map((b) => {
      const start = dayMin(toMin(b.start_time));
      return { b, start, end: start + b.duration_min };
    })
    .sort((a, b) => a.start - b.start);
  const slot = (x: (typeof open)[number]): BlockSlot => {
    const hm = (m: number) =>
      `${String(Math.floor((m % 1440) / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    return { title: x.b.title, start: hm(x.start), end: hm(x.end), kind: x.b.kind };
  };
  const now = open.find((x) => x.start <= t && t < x.end) ?? null;
  const upcoming = open.filter((x) => x.start > t);
  const next = upcoming[0] ?? null;
  const after = (now ? upcoming[0] : upcoming[1]) ?? null;
  return {
    now: now ? slot(now) : null,
    next: next ? slot(next) : null,
    after: after ? slot(after) : null,
  };
}

/** Water expected by now on a straight line from wake to the target time (app's expectedBy). */
export function waterExpected(minutes: number, wake: string, target: string, ml: number): number {
  const w = toMin(wake);
  const span = toMin(target) - w;
  if (span <= 0) return ml;
  return Math.round(Math.min(Math.max((minutes - w) / span, 0), 1) * ml);
}

// ---------------------------------------------------------------------------
// The response
// ---------------------------------------------------------------------------

export type SummaryInput = {
  now: number;
  profile: {
    water_target_ml: number;
    wake_time: string;
    monthly_budget_inr: number;
    steps_min: number;
  } | null;
  dayLogs: readonly {
    date: string;
    score: number | null;
    template_id: string | null;
    updated_at: string;
    deleted_at: string | null;
  }[];
  templates: readonly (TemplateLike & { name: string })[];
  blocks: readonly BlockLike[];
  /** Today's block ids that are done or skipped. */
  logged: ReadonlySet<string>;
  waterMl: number;
  monthSpend: number;
  top3: readonly { title: string; status: string }[];
  steps: number | null;
};

export type Summary = {
  date: string;
  updated_at: string;
  score: number | null;
  /** When the app last saved today's score (score changes as you tick blocks in the app). */
  score_at: string | null;
  streak: number;
  done: number;
  counted: number;
  water_ml: number;
  water_target: number;
  water_behind: number;
  next_block: (BlockSlot & { status: 'now' | 'next' }) | null;
  after: BlockSlot | null;
  month_spend: number;
  month_budget: number;
  top3: { title: string; done: boolean }[];
  steps: number | null;
  steps_min: number;
  template: string | null;
};

export function buildSummary(i: SummaryInput): Summary {
  const { today, minutes } = istNow(i.now);
  const todayLog = i.dayLogs.find((d) => d.date === today && !d.deleted_at) ?? null;
  const tpl = templateFor(i.templates, today, todayLog?.template_id ?? null);
  const blocks = tpl ? i.blocks.filter((b) => b.template_id === tpl.id && !b.deleted_at) : [];
  const waters = blocks
    .filter((b) => b.kind === 'water')
    .sort((a, b) => a.start_time.localeCompare(b.start_time));
  const targetTime = waters.at(-1)?.start_time ?? '21:00';
  const waterTarget = i.profile?.water_target_ml ?? 3000;
  const expected = waterExpected(minutes, i.profile?.wake_time ?? '05:00', targetTime, waterTarget);
  const { now, next, after } = nowAndNext(blocks, i.logged, minutes);
  const current = now ?? next;
  return {
    date: today,
    updated_at: new Date(i.now).toISOString(),
    score: todayLog?.score ?? null,
    score_at: todayLog?.updated_at ?? null,
    streak: currentStreak(i.dayLogs, today, todayLog?.score ?? null),
    done: blocks.filter((b) => i.logged.has(b.id)).length,
    counted: blocks.length,
    water_ml: i.waterMl,
    water_target: waterTarget,
    water_behind: i.waterMl >= waterTarget ? 0 : Math.max(0, expected - i.waterMl),
    next_block: current ? { ...current, status: now ? 'now' : 'next' } : null,
    after,
    month_spend: Math.round(i.monthSpend),
    month_budget: i.profile?.monthly_budget_inr ?? 18000,
    top3: i.top3.map((t) => ({ title: t.title, done: t.status === 'done' })),
    steps: i.steps,
    steps_min: i.profile?.steps_min ?? 6000,
    template: tpl?.name ?? null,
  };
}
