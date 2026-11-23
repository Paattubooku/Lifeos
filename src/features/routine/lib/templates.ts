import { type DateString, isoWeekday } from '@/lib/dates';

export type TemplateLike = {
  id: string;
  weekdays: number[];
  is_default: boolean;
  updated_at: string;
  deleted_at?: string | null;
};

/**
 * The template that runs on `date` (PRD F04): the one whose weekdays contain the
 * day; if several claim it, the last edited wins; if none, the default template.
 */
export function templateForDate<T extends TemplateLike>(
  templates: readonly T[],
  date: DateString,
): T | null {
  const live = templates.filter((t) => !t.deleted_at);
  const day = isoWeekday(date);
  const claiming = live
    .filter((t) => t.weekdays.includes(day))
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  return claiming[0] ?? live.find((t) => t.is_default) ?? null;
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
