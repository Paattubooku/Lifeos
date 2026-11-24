import type { Change } from '@/features/routine/lib/changes';
import { planBlockStatus } from '@/features/today/lib/changes';
import { addDays, type DateString, istMinutesOfDay, logicalDate, logicalMoment } from '@/lib/dates';

export type SleepRow = {
  client_id: string;
  date: DateString;
  bed_at: string | null;
  wake_at: string | null;
  phone_off_kept: boolean | null;
  deleted_at?: string | null;
};

/** Target night (PRD F14): 7 h. */
export const TARGET_HOURS = 7;
/** Waking within this many minutes of wake time counts as "on time" and ticks Wake (AC2: 05:15 for 05:00). */
export const WAKE_GRACE_MIN = 15;
export const NIGHTS = 14;

/** Hours between bed and wake, 1 decimal (AC1: 22:40 → 05:05 = 6.4 h). */
export function hoursSlept(bedAt: string | number, wakeAt: string | number): number {
  const ms = new Date(wakeAt).getTime() - new Date(bedAt).getTime();
  return Math.round((ms / 3_600_000) * 10) / 10;
}

/** A night belongs to the logical date of the morning it ends (AC1). */
export const nightDate = (wakeAt: string | number) => logicalDate(wakeAt);

/** Instants for "went to bed HH:mm, woke HH:mm" on the night ending on `date`. */
export function nightTimes(
  date: DateString,
  bed: string,
  wake: string,
): { bedAt: number; wakeAt: number } {
  return { bedAt: logicalMoment(addDays(date, -1), bed), wakeAt: logicalMoment(date, wake) };
}

const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const round5 = (m: number) => Math.round(m / 5) * 5;
const hhmm = (m: number) => {
  const x = ((m % 1440) + 1440) % 1440;
  return `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`;
};

/**
 * Morning check: from wake time onwards, until last night is logged.
 * Defaults: bed = profile sleep time, wake = now (to 5 min).
 */
export function morningCheck(
  now: number,
  today: DateString,
  profile: { wake_time: string; sleep_time: string },
  last: SleepRow | null,
): { bed: string; wake: string } | null {
  const nowMin = istMinutesOfDay(now);
  if (nowMin < toMin(profile.wake_time) || nowMin >= 12 * 60) return null;
  if (last && !last.deleted_at && last.date === today && last.wake_at) return null;
  return { bed: profile.sleep_time.slice(0, 5), wake: hhmm(round5(nowMin)) };
}

/** AC2: woke ≤ wake time + 15 min → the Wake block is done. */
export const wokeOnTime = (wake: string, wakeTime: string) =>
  toMin(wake) <= toMin(wakeTime) + WAKE_GRACE_MIN;

/** Log (or correct) last night on its morning's row; keeps phone_off_kept. */
export function planNight(
  date: DateString,
  existing: SleepRow | null,
  bed: string,
  wake: string,
): Change[] {
  const { bedAt, wakeAt } = nightTimes(date, bed, wake);
  return [
    {
      op: 'upsert',
      table: 'sleep_log',
      ...(existing ? { clientId: existing.client_id } : {}),
      row: {
        date,
        bed_at: new Date(bedAt).toISOString(),
        wake_at: new Date(wakeAt).toISOString(),
        deleted_at: null,
      },
    },
  ];
}

/**
 * Ticking "Phone away" on day D marks the night ending on D + 1 (PRD F14).
 * Unticking clears it.
 */
export function planPhoneOff(day: DateString, existing: SleepRow | null, kept: boolean): Change[] {
  return [
    {
      op: 'upsert',
      table: 'sleep_log',
      ...(existing ? { clientId: existing.client_id } : {}),
      row: { date: addDays(day, 1), phone_off_kept: kept, deleted_at: null },
    },
  ];
}

export type Night = {
  date: DateString;
  hours: number | null;
  bedMin: number | null;
  phoneOff: boolean | null;
};

/** Bedtime as minutes from 18:00 so 22:40 and 00:10 compare sensibly. */
export const bedOffset = (bedAt: string) => (istMinutesOfDay(bedAt) - 18 * 60 + 1440) % 1440;

/** The last 14 nights ending today (null where nothing was logged). */
export function lastNights(rows: readonly SleepRow[], today: DateString, n = NIGHTS): Night[] {
  return Array.from({ length: n }, (_, i) => {
    const date = addDays(today, i - n + 1);
    const r = rows.find((x) => x.date === date && !x.deleted_at);
    return {
      date,
      hours: r?.bed_at && r.wake_at ? hoursSlept(r.bed_at, r.wake_at) : null,
      bedMin: r?.bed_at ? bedOffset(r.bed_at) : null,
      phoneOff: r?.phone_off_kept ?? null,
    };
  });
}

export type SleepStats = {
  avg7: number | null;
  atTarget: number;
  logged: number;
  /** Population std dev of bedtime, minutes. */
  bedSpread: number | null;
  /** Average bedtime 'HH:mm'. */
  bedAvg: string | null;
  phoneKept: number;
};

export function sleepStats(nights: readonly Night[]): SleepStats {
  const hours = nights.map((n) => n.hours).filter((h): h is number => h !== null);
  const week = nights
    .slice(-7)
    .map((n) => n.hours)
    .filter((h): h is number => h !== null);
  const beds = nights.map((n) => n.bedMin).filter((b): b is number => b !== null);
  const mean = beds.length ? beds.reduce((s, b) => s + b, 0) / beds.length : null;
  const sd =
    mean === null || beds.length < 2
      ? null
      : Math.round(Math.sqrt(beds.reduce((s, b) => s + (b - mean) ** 2, 0) / beds.length));
  return {
    avg7: week.length
      ? Math.round((week.reduce((s, h) => s + h, 0) / week.length) * 10) / 10
      : null,
    atTarget: hours.filter((h) => h >= TARGET_HOURS).length,
    logged: hours.length,
    bedSpread: sd,
    bedAvg: mean === null ? null : hhmm(Math.round(mean) + 18 * 60),
    phoneKept: nights.filter((n) => n.phoneOff === true).length,
  };
}

/** "6 h 25 m". */
export function durationText(bedAt: string | number, wakeAt: string | number): string {
  const m = Math.round((new Date(wakeAt).getTime() - new Date(bedAt).getTime()) / 60000);
  return `${Math.floor(m / 60)} h ${m % 60} m`;
}

/**
 * AC2: logging a night that ended ≤ 15 min after the Wake block ticks it,
 * unless that block already has a log for the day (done or skipped).
 */
export function planWakeTick(
  date: DateString,
  wakeBlock: { id: string; start_time: string } | undefined,
  log: { client_id: string; deleted_at: string | null } | null,
  wake: string,
  now: number,
): Change[] {
  if (!wakeBlock || (log && !log.deleted_at)) return [];
  if (!wokeOnTime(wake, wakeBlock.start_time)) return [];
  return planBlockStatus(wakeBlock.id, date, log, { status: 'done' }, now);
}

/** "40 min after your 10:00 pm target" / "on your 10:00 pm target". */
export function vsTarget(bed: string, target: string, label: string): string {
  const d = ((toMin(bed) - toMin(target) + 720 + 1440) % 1440) - 720;
  if (d === 0) return `on your ${label} target`;
  return `${Math.abs(d)} min ${d > 0 ? 'after' : 'before'} your ${label} target`;
}

/** Bedtime offset (minutes after 18:00) back to 'HH:mm'. */
export const offsetClock = (offset: number) => hhmm(Math.round(offset) + 18 * 60);

/** "Average bedtime 10:32 pm, 32 min late." */
export function bedtimeLine(avg: string, target: string, label: (t: string) => string): string {
  const d = ((toMin(avg) - toMin(target) + 720 + 1440) % 1440) - 720;
  const how = d === 0 ? 'on time' : `${Math.abs(d)} min ${d > 0 ? 'late' : 'early'}`;
  return `Average bedtime ${label(avg)}, ${how}.`;
}

/** 'HH:mm' as minutes after 18:00 (same scale as bedOffset). */
export const clockOffset = (t: string) => (toMin(t) - 18 * 60 + 1440) % 1440;
