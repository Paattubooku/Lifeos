import { addDays, type DateString, isoWeekday } from '@/lib/dates';

export type TemplateLike = {
  id: string;
  weekdays: number[];
  is_default: boolean;
  updated_at: string;
  deleted_at?: string | null;
  archived_at?: string | null;
};

/**
 * The template that runs on `date` (PRD F04): the one whose weekdays contain the
 * day; if several claim it, the last edited wins; if none, the default template.
 * Archived templates never match a weekday.
 */
export function templateForDate<T extends TemplateLike>(
  templates: readonly T[],
  date: DateString,
): T | null {
  const live = templates.filter((t) => !t.deleted_at && !t.archived_at);
  const day = isoWeekday(date);
  const claiming = live
    .filter((t) => t.weekdays.includes(day))
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  return claiming[0] ?? live.find((t) => t.is_default) ?? null;
}

/**
 * The template a date runs: a manual "Switch template for today" stored on the
 * day's `day_log.template_id` wins (even if that template was archived since);
 * otherwise the weekday rule.
 */
export function resolveTemplate<T extends TemplateLike>(
  templates: readonly T[],
  date: DateString,
  dayLog?: { template_id?: string | null; deleted_at?: string | null } | null,
): T | null {
  const manual = dayLog && !dayLog.deleted_at ? dayLog.template_id : null;
  const chosen = manual ? templates.find((t) => t.id === manual && !t.deleted_at) : undefined;
  return chosen ?? templateForDate(templates, date);
}

export const WEEKDAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
export const WEEKDAY_LETTER = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;

/** 'Mon–Fri', 'Sat–Sun', 'Mon, Wed', or 'Manual' when no weekday is assigned. */
export function weekdaysText(weekdays: readonly number[]): string {
  const days = [...new Set(weekdays)].sort((a, b) => a - b);
  if (days.length === 0) return 'Manual';
  if (days.length === 7) return 'Every day';
  const name = (d: number) => WEEKDAY_SHORT[d - 1] as string;
  const contiguous = days.every((d, i) => i === 0 || d === (days[i - 1] as number) + 1);
  if (days.length === 1) return name(days[0] as number);
  if (contiguous) return `${name(days[0] as number)}–${name(days[days.length - 1] as number)}`;
  return days.map(name).join(', ');
}

/** Templates shown in lists: live, not archived, by `sort` then name. */
export function activeTemplates<T extends TemplateLike & { sort: number; name: string }>(
  templates: readonly T[],
): T[] {
  return templates
    .filter((t) => !t.deleted_at && !t.archived_at)
    .sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name));
}

export type WeekdayConflict<T> = { weekday: number; winner: T; others: T[] };

/** Weekdays claimed by more than one active template (PRD F04: last edited wins, warn). */
export function weekdayConflicts<T extends TemplateLike>(
  templates: readonly T[],
): WeekdayConflict<T>[] {
  const live = templates.filter((t) => !t.deleted_at && !t.archived_at);
  const out: WeekdayConflict<T>[] = [];
  for (let day = 1; day <= 7; day++) {
    const claiming = live
      .filter((t) => t.weekdays.includes(day))
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    if (claiming.length > 1) {
      const [winner, ...others] = claiming as [T, ...T[]];
      out.push({ weekday: day, winner, others });
    }
  }
  return out;
}

/** "Sat is claimed by Weekend and Rest day — Weekend (last edited) wins." */
export function conflictText(c: WeekdayConflict<{ name: string }>): string {
  const names = [c.winner, ...c.others].map((t) => t.name);
  const list = names.length === 2 ? names.join(' and ') : names.join(', ');
  return `${WEEKDAY_SHORT[c.weekday - 1]} is claimed by ${list} — ${c.winner.name} (last edited) wins.`;
}

/** Which template runs on each weekday (Mon … Sun) by the weekday rule. */
export function weekStrip<T extends TemplateLike>(
  templates: readonly T[],
  anyMonday: DateString,
): (T | null)[] {
  return [0, 1, 2, 3, 4, 5, 6].map((i) => templateForDate(templates, addDays(anyMonday, i)));
}

/** 'Workday (Mon–Fri)', 'Weekend (Sat–Sun)', 'Rest day' — for summaries. */
export function templateLabel(t: { name: string; weekdays: number[] }): string {
  const names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const days = [...t.weekdays].sort((a, b) => a - b);
  if (days.length === 0) return t.name;
  const contiguous = days.every((d, i) => i === 0 || d === (days[i - 1] as number) + 1);
  const range =
    days.length === 1
      ? names[(days[0] as number) - 1]
      : contiguous
        ? `${names[(days[0] as number) - 1]}–${names[(days[days.length - 1] as number) - 1]}`
        : days.map((d) => names[d - 1]).join(', ');
  return `${t.name} (${range})`;
}

/**
 * One distinct letter per template for the week strip: the first letter of the
 * name not already taken (Workday → W, Weekend → E, as in the design).
 */
export function stripLetters(
  templates: readonly { id: string; name: string }[],
): Map<string, string> {
  const used = new Set<string>();
  const out = new Map<string, string>();
  for (const t of templates) {
    const letters = t.name.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const pick = [...letters].find((c) => !used.has(c)) ?? letters.charAt(0) ?? '?';
    used.add(pick);
    out.set(t.id, pick || '?');
  }
  return out;
}
