import { useEffect, useRef } from 'react';

import { applySchedule, scheduleKey } from '../os';
import type { Reminder } from '../schedule';

const DEBOUNCE_MS = 1500;

/**
 * Keeps the phone's scheduled reminders equal to `reminders`. Rebuilds when
 * the schedule changes (app open, template/profile edits, logging water or a
 * meal…), debounced; unchanged schedules aren't touched.
 */
export function useReminderSync(reminders: readonly Reminder[]) {
  const applied = useRef<string | null>(null);
  const key = scheduleKey(reminders);
  useEffect(() => {
    if (key === applied.current) return;
    const timer = setTimeout(() => {
      applied.current = key;
      void applySchedule(reminders);
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // `key` captures every change to `reminders`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}
