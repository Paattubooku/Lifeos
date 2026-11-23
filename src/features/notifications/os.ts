import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { Platform } from 'react-native';

import type { Reminder } from './schedule';

export const ANDROID_CHANNEL = 'reminders';
/** The workout rest timer's notification (F11), never touched by reminder rebuilds. */
export const REST_ID = 'rest-timer';

/** Show reminders while the app is open too; set up the Android channel once. */
export async function configureNotifications(): Promise<void> {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL, {
      name: 'Reminders',
      importance: AndroidImportance.HIGH,
    }).catch(() => undefined);
  }
}

/** A stable fingerprint, so unchanged schedules aren't rebuilt. */
export const scheduleKey = (rs: readonly Reminder[]) =>
  rs.map((r) => `${r.id}|${r.at}|${r.title}|${r.body}`).join('\n');

/**
 * Replace every LifeOS reminder with `reminders` (local notifications only,
 * PRD §6). Returns how many were scheduled; 0 without permission.
 */
export async function applySchedule(
  reminders: readonly Reminder[],
  now = Date.now(),
): Promise<number> {
  const perm = await Notifications.getPermissionsAsync().catch(() => null);
  if (!perm?.granted) return 0;
  // Replace reminders only; leave other notifications (the rest timer) alone.
  const scheduled = await Notifications.getAllScheduledNotificationsAsync().catch(() => []);
  for (const s of scheduled)
    if (s.identifier !== REST_ID)
      await Notifications.cancelScheduledNotificationAsync(s.identifier);
  let n = 0;
  for (const r of reminders) {
    if (r.at <= now) continue;
    await Notifications.scheduleNotificationAsync({
      identifier: r.id,
      content: { title: r.title, body: r.body, data: { url: r.url } },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(r.at),
        ...(Platform.OS === 'android' ? { channelId: ANDROID_CHANNEL } : {}),
      },
    });
    n++;
  }
  return n;
}

const ALLOWED = ['/today', '/water', '/train', '/meal/', '/streaks', '/progress'];

/** The screen a tapped reminder opens (F15 AC3), or null for anything unexpected. */
export function routeFor(data: unknown): string | null {
  const url = (data as { url?: unknown } | null)?.url;
  if (typeof url !== 'string') return null;
  if (url.startsWith('/meal/'))
    return /^\/meal\/(breakfast|lunch|snack|dinner)$/.test(url) ? url : null;
  if (url.startsWith('/session/')) return /^\/session\/\d{4}-\d{2}-\d{2}$/.test(url) ? url : null;
  return ALLOWED.includes(url) ? url : null;
}

/** F11 AC2: the rest timer rings even with the app in the background. */
export async function scheduleRestEnd(endsAt: number, body: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(REST_ID).catch(() => undefined);
  if (endsAt <= Date.now()) return;
  const perm = await Notifications.getPermissionsAsync().catch(() => null);
  if (!perm?.granted) return;
  await Notifications.scheduleNotificationAsync({
    identifier: REST_ID,
    content: { title: 'Rest over', body, data: { url: '/train' } },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: new Date(endsAt),
      ...(Platform.OS === 'android' ? { channelId: ANDROID_CHANNEL } : {}),
    },
  });
}

export const cancelRestEnd = () =>
  Notifications.cancelScheduledNotificationAsync(REST_ID).catch(() => undefined);
