import * as Notifications from 'expo-notifications';
import { type Href, useRouter } from 'expo-router';
import { useEffect } from 'react';

import { configureNotifications, routeFor } from '../os';

/** Tapping a reminder opens its screen (also when it launched the app). */
export function useNotificationRouting(enabled: boolean) {
  const router = useRouter();
  useEffect(() => {
    if (!enabled) return;
    void configureNotifications();
    const open = (data: unknown) => {
      const url = routeFor(data);
      if (url) router.push(url as Href);
    };
    void Notifications.getLastNotificationResponseAsync()
      .then((r) => {
        if (r) {
          open(r.notification.request.content.data);
          void Notifications.clearLastNotificationResponseAsync?.();
        }
      })
      .catch(() => undefined);
    const sub = Notifications.addNotificationResponseReceivedListener((r) =>
      open(r.notification.request.content.data),
    );
    return () => sub.remove();
  }, [enabled, router]);
}
