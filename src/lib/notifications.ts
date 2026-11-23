import * as Notifications from 'expo-notifications';
import { Linking } from 'react-native';

export type ReminderPermission = {
  granted: boolean;
  /** false once the user said no in the system dialog — only Settings can change it then. */
  canAskAgain: boolean;
};

export async function getReminderPermission(): Promise<ReminderPermission> {
  try {
    const p = await Notifications.getPermissionsAsync();
    return { granted: p.granted, canAskAgain: p.canAskAgain };
  } catch {
    return { granted: false, canAskAgain: false };
  }
}

/** Asks the OS if it still may; otherwise opens the app's system settings. */
export async function enableReminders(): Promise<ReminderPermission> {
  const current = await getReminderPermission();
  if (current.granted) return current;
  if (current.canAskAgain) {
    try {
      const p = await Notifications.requestPermissionsAsync();
      return { granted: p.granted, canAskAgain: p.canAskAgain };
    } catch {
      return current;
    }
  }
  await Linking.openSettings().catch(() => undefined);
  return current;
}
