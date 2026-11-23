/**
 * All calendar-day maths for LifeOS (PRD §4.1). Never derive a day any other way.
 *
 * - Time zone: Asia/Kolkata = UTC+05:30 all year (India has no DST), so plain
 *   arithmetic is exact and identical on every device and in tests.
 * - Logical day: runs 03:00 → 02:59 IST; a log at 00:30 belongs to "yesterday".
 * - Dates are 'YYYY-MM-DD' strings; weeks start on Monday.
 */

const MINUTE = 60_000;
const DAY = 86_400_000;
export const IST_OFFSET_MIN = 330;
export const LOGICAL_DAY_START_HOUR = 3;

export type DateString = string; // 'YYYY-MM-DD'

const pad = (n: number, w = 2) => String(n).padStart(w, '0');

function formatUtcDate(d: Date): DateString {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

function toMs(ts: Date | number | string): number {
  const ms = ts instanceof Date ? ts.getTime() : typeof ts === 'string' ? Date.parse(ts) : ts;
  if (!Number.isFinite(ms)) throw new Error(`Invalid timestamp: ${String(ts)}`);
  return ms;
}

/** Calendar date in IST (midnight boundary). */
export function istDate(ts: Date | number | string): DateString {
  return formatUtcDate(new Date(toMs(ts) + IST_OFFSET_MIN * MINUTE));
}

/** The logical day a moment belongs to (03:00 IST boundary). */
export function logicalDate(ts: Date | number | string): DateString {
  const shifted = toMs(ts) + (IST_OFFSET_MIN - LOGICAL_DAY_START_HOUR * 60) * MINUTE;
  return formatUtcDate(new Date(shifted));
}

export function todayLogical(now: Date | number = Date.now()): DateString {
  return logicalDate(now);
}

/** Minutes since IST midnight (0–1439), for comparing with 'HH:mm' plan times. */
export function istMinutesOfDay(ts: Date | number | string): number {
  const d = new Date(toMs(ts) + IST_OFFSET_MIN * MINUTE);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

export function parseDate(date: DateString): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) throw new Error(`Invalid date "${date}"`);
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (formatUtcDate(d) !== date) throw new Error(`Invalid date "${date}"`);
  return d;
}

export function addDays(date: DateString, days: number): DateString {
  return formatUtcDate(new Date(parseDate(date).getTime() + days * DAY));
}

/** ISO weekday: 1 = Monday … 7 = Sunday (matches routine_template.weekdays). */
export function isoWeekday(date: DateString): number {
  const dow = parseDate(date).getUTCDay();
  return dow === 0 ? 7 : dow;
}

/** Monday of the week containing `date`. */
export function weekStart(date: DateString): DateString {
  return addDays(date, 1 - isoWeekday(date));
}

/** Whole days from `a` to `b` (b − a). */
export function daysBetween(a: DateString, b: DateString): number {
  return Math.round((parseDate(b).getTime() - parseDate(a).getTime()) / DAY);
}

/**
 * The instant of an 'HH:mm' plan time on a logical day. Times before 03:00
 * belong to the night after the calendar date (logical day rule).
 */
export function logicalMoment(date: DateString, hhmm: string): number {
  const m = /^(\d{2}):(\d{2})/.exec(hhmm);
  if (!m) throw new Error(`Invalid time "${hhmm}"`);
  const minutes = Number(m[1]) * 60 + Number(m[2]);
  const day = minutes < LOGICAL_DAY_START_HOUR * 60 ? addDays(date, 1) : date;
  return parseDate(day).getTime() + (minutes - IST_OFFSET_MIN) * MINUTE;
}

/** 'HH:mm' wall-clock time in IST of an instant. */
export function istClock(ts: Date | number | string): string {
  const m = istMinutesOfDay(ts);
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}
