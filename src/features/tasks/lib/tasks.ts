import type { Change } from '@/features/routine/lib/changes';
import { addDays, type DateString, daysBetween } from '@/lib/dates';

export type Priority = 'high' | 'medium' | 'low';
export const PRIORITIES: readonly Priority[] = ['high', 'medium', 'low'];
/** Reference weights (Tracker TodoTracker): high 3, medium 2, low 1. */
export const PRIORITY_WEIGHT: Record<Priority, number> = { high: 3, medium: 2, low: 1 };
export const TOP3_MAX = 3;
export const COMPLETED_DAYS = 14;

export type TaskRow = {
  client_id: string;
  title: string;
  priority: string;
  due_date: string | null;
  is_top3: boolean;
  top3_date: string | null;
  status: string;
  done_at: string | null;
  created_at?: string | null;
  deleted_at?: string | null;
};

const weight = (p: string) => PRIORITY_WEIGHT[p as Priority] ?? PRIORITY_WEIGHT.medium;
const live = (t: TaskRow) => !t.deleted_at;

/** Pending order (AC2): priority high → low, then due date (soonest first, none last), then newest. */
export function comparePending(a: TaskRow, b: TaskRow): number {
  if (weight(a.priority) !== weight(b.priority)) return weight(b.priority) - weight(a.priority);
  if (a.due_date !== b.due_date) {
    if (a.due_date === null) return 1;
    if (b.due_date === null) return -1;
    return a.due_date < b.due_date ? -1 : 1;
  }
  return String(b.created_at ?? '').localeCompare(String(a.created_at ?? ''));
}

/** Today's top 3 (open or done today), in pending order. */
export const isTop3Today = (t: TaskRow, today: DateString) =>
  live(t) && t.is_top3 && t.top3_date === today;

export function top3(tasks: readonly TaskRow[], today: DateString): TaskRow[] {
  return tasks.filter((t) => isTop3Today(t, today)).sort(comparePending);
}

/** Open tasks not in today's top 3, sorted. */
export function pending(tasks: readonly TaskRow[], today: DateString): TaskRow[] {
  return tasks
    .filter((t) => live(t) && t.status === 'open' && !isTop3Today(t, today))
    .sort(comparePending);
}

/** Done in the last 14 days (by done time), newest first. */
export function completed(tasks: readonly TaskRow[], now: number): TaskRow[] {
  const from = now - COMPLETED_DAYS * 864e5;
  return tasks
    .filter((t) => live(t) && t.status === 'done' && t.done_at && Date.parse(t.done_at) >= from)
    .sort((a, b) => String(b.done_at).localeCompare(String(a.done_at)));
}

/** Yesterday's unfinished top 3, offered again today (never added automatically). */
export function suggestions(tasks: readonly TaskRow[], today: DateString): TaskRow[] {
  const yesterday = addDays(today, -1);
  return tasks
    .filter((t) => live(t) && t.status === 'open' && t.top3_date === yesterday)
    .sort(comparePending);
}

/** Overdue only when the due date is before the logical today (not on it). */
export const isOverdue = (t: TaskRow, today: DateString) =>
  t.status === 'open' && t.due_date !== null && t.due_date < today;

/** "2 overdue · 3 due this week" (open tasks; this week = today … +6). */
export function headerLine(tasks: readonly TaskRow[], today: DateString): string {
  const open = tasks.filter((t) => live(t) && t.status === 'open');
  const overdue = open.filter((t) => isOverdue(t, today)).length;
  const week = open.filter(
    (t) => t.due_date !== null && t.due_date >= today && t.due_date <= addDays(today, 6),
  ).length;
  if (open.length === 0) return 'Nothing pending';
  return `${overdue} overdue · ${week} due this week`;
}

/** "4 days overdue" / "Due today" / "Due tomorrow" / null. */
export function dueNote(t: TaskRow, today: DateString): string | null {
  if (!t.due_date) return null;
  const d = daysBetween(today, t.due_date);
  if (t.status !== 'open') return null;
  if (d < 0) return `${-d} ${d === -1 ? 'day' : 'days'} overdue`;
  if (d === 0) return 'Due today';
  if (d === 1) return 'Due tomorrow';
  return null;
}

/** Writes that take stale top-3 flags (earlier days) off, so open is_top3 rows stay ≤ 3 (AC1). */
function clearStale(tasks: readonly TaskRow[], today: DateString): Change[] {
  return tasks
    .filter((t) => live(t) && t.is_top3 && t.top3_date !== today)
    .map((t) => ({
      op: 'upsert' as const,
      table: 'task' as const,
      clientId: t.client_id,
      row: { is_top3: false },
    }));
}

export type Top3Result = { ok: true; changes: Change[] } | { ok: false; full: TaskRow[] };

/**
 * Put a task in today's top 3. When 3 are already there, return them so the
 * user picks one to swap out (`swapOut`), which goes back to pending.
 */
export function planAddTop3(
  tasks: readonly TaskRow[],
  today: DateString,
  task: { clientId?: string; row?: Record<string, unknown> },
  swapOut?: string,
): Top3Result {
  const current = top3(tasks, today).filter((t) => t.client_id !== task.clientId);
  const out = swapOut ? current.find((t) => t.client_id === swapOut) : undefined;
  if (current.length - (out ? 1 : 0) >= TOP3_MAX) return { ok: false, full: current };
  return {
    ok: true,
    changes: [
      ...clearStale(tasks, today),
      ...(out
        ? [
            {
              op: 'upsert' as const,
              table: 'task' as const,
              clientId: out.client_id,
              row: { is_top3: false },
            },
          ]
        : []),
      {
        op: 'upsert',
        table: 'task' as const,
        ...(task.clientId ? { clientId: task.clientId } : {}),
        row: { ...task.row, is_top3: true, top3_date: today },
      },
    ],
  };
}

export const planRemoveTop3 = (clientId: string): Change[] => [
  { op: 'upsert', table: 'task', clientId, row: { is_top3: false } },
];

export function planNewTask(input: {
  title: string;
  priority: Priority;
  dueDate: DateString | null;
}): Record<string, unknown> {
  return {
    title: input.title.trim().slice(0, 200),
    priority: input.priority,
    due_date: input.dueDate,
    status: 'open',
    is_top3: false,
    done_at: null,
  };
}

export function planToggleDone(t: TaskRow, now: number): Change[] {
  const done = t.status !== 'done';
  return [
    {
      op: 'upsert',
      table: 'task' as const,
      clientId: t.client_id,
      row: { status: done ? 'done' : 'open', done_at: done ? new Date(now).toISOString() : null },
    },
  ];
}
