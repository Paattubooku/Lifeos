import { applyChanges } from '@/features/routine/slice';
import { useAppDispatch } from '@/store';
import { haptics, useSnackbar } from '@/ui';

import type { TaskDbRow } from '../api';
import {
  planAddTop3,
  planNewTask,
  planRemoveTop3,
  planToggleDone,
  type Priority,
  type TaskRow,
} from '../lib/tasks';

/** Event-time clock (kept out of render for the React Compiler). */
const clock = () => Date.now();

export type NewTask = { title: string; priority: Priority; dueDate: string | null; top3: boolean };

/**
 * Task writes (optimistic, through the sync queue). Adding to a full top 3
 * returns the current three so the screen can ask which one to swap out.
 */
export function useTaskActions(all: readonly TaskDbRow[], today: string) {
  const dispatch = useAppDispatch();
  const showSnackbar = useSnackbar();
  const apply = (c: Parameters<typeof applyChanges>[0]) => dispatch(applyChanges(c));

  const toggleDone = (t: TaskRow) => {
    haptics.tap();
    const done = t.status !== 'done';
    void apply(planToggleDone(t, clock()));
    showSnackbar({
      message: done ? `${t.title} done` : `${t.title} reopened`,
      actionLabel: 'Undo',
      onAction: () =>
        void apply([
          {
            op: 'upsert',
            table: 'task',
            clientId: t.client_id,
            row: { status: t.status, done_at: t.done_at },
          },
        ]),
    });
  };

  /** null = added; otherwise the full top 3 to pick from. */
  const addToTop3 = (t: TaskRow, swapOut?: string): TaskRow[] | null => {
    const r = planAddTop3(all, today, { clientId: t.client_id }, swapOut);
    if (!r.ok) return r.full;
    void apply(r.changes);
    showSnackbar({ message: `${t.title} is in today’s top 3` });
    return null;
  };

  const removeFromTop3 = (t: TaskRow) => {
    void apply(planRemoveTop3(t.client_id));
    showSnackbar({
      message: `${t.title} back to pending`,
      actionLabel: 'Undo',
      onAction: () => void addToTop3(t),
    });
  };

  /** Create a task; with `top3` when the top 3 is full, returns the three to swap from. */
  const create = (input: NewTask, swapOut?: string): TaskRow[] | null => {
    const row = planNewTask(input);
    if (input.top3) {
      const r = planAddTop3(all, today, { row }, swapOut);
      if (!r.ok) return r.full;
      void apply(r.changes);
    } else void apply([{ op: 'upsert', table: 'task', row }]);
    showSnackbar({ message: `${String(row.title)} added` });
    return null;
  };

  const remove = (t: TaskRow) => {
    void apply([{ op: 'delete', table: 'task', clientId: t.client_id }]);
    showSnackbar({
      message: `${t.title} deleted`,
      actionLabel: 'Undo',
      onAction: () =>
        void apply([
          { op: 'upsert', table: 'task', clientId: t.client_id, row: { deleted_at: null } },
        ]),
    });
  };

  return { toggleDone, addToTop3, removeFromTop3, create, remove };
}
