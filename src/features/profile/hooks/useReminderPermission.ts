import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import {
  enableReminders,
  getReminderPermission,
  type ReminderPermission,
} from '@/lib/notifications';

/** Current notification permission, re-checked when the app returns from Settings. */
export function useReminderPermission() {
  const [permission, setPermission] = useState<ReminderPermission | null>(null);

  useEffect(() => {
    let alive = true;
    const refresh = () =>
      getReminderPermission().then((p) => {
        if (alive) setPermission(p);
      });
    void refresh();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void refresh();
    });
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);

  const enable = useCallback(async () => setPermission(await enableReminders()), []);

  return { permission, enable };
}
