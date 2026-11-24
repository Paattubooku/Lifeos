import { Pedometer } from 'expo-sensors';
import { Platform } from 'react-native';

import { addDays, type DateString, istDate } from '@/lib/dates';

/**
 * iPhone motion-chip step counts (Core Motion via expo-sensors), the free
 * automatic source: works in Expo Go and needs no Apple Developer account.
 * iOS keeps the last 7 days; Android can't read past days (live only), so
 * this source is iPhone-only.
 */
export const MOTION_DAYS = 7;

const istMidnight = (date: DateString) => new Date(`${date}T00:00:00+05:30`);

/** [start, end) of each IST calendar day for the last `days` days, today ending now. */
export function dayWindows(
  days: number,
  now: number,
): { date: DateString; start: Date; end: Date }[] {
  const today = istDate(now);
  return Array.from({ length: days }, (_, i) => {
    const date = addDays(today, i - days + 1);
    const end = date === today ? new Date(now) : istMidnight(addDays(date, 1));
    return { date, start: istMidnight(date), end };
  });
}

export async function motionAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  return Pedometer.isAvailableAsync().catch(() => false);
}

/** Has Motion & Fitness access already been given (no prompt)? */
export async function motionGranted(): Promise<boolean> {
  const p = await Pedometer.getPermissionsAsync().catch(() => null);
  return Boolean(p?.granted);
}

/** Ask for Motion & Fitness access (iOS shows its prompt once). */
export async function requestMotion(): Promise<boolean> {
  const p = await Pedometer.requestPermissionsAsync().catch(() => null);
  return Boolean(p?.granted);
}

/** Steps per IST day for the last 7 days (whole days, today until now). */
export async function motionStepsByDay(now: number): Promise<Map<DateString, number>> {
  const out = new Map<DateString, number>();
  for (const w of dayWindows(MOTION_DAYS, now)) {
    const r = await Pedometer.getStepCountAsync(w.start, w.end);
    out.set(w.date, Math.max(0, Math.round(r.steps)));
  }
  return out;
}

/** Today's steps so far. */
export async function motionToday(now: number): Promise<number> {
  const w = dayWindows(1, now)[0]!;
  return Math.round((await Pedometer.getStepCountAsync(w.start, w.end)).steps);
}

/** Live updates while a screen is open: steps since the watch started. */
export function watchMotion(onSteps: (sinceStart: number) => void): () => void {
  const sub = Pedometer.watchStepCount((r) => onSteps(r.steps));
  return () => sub.remove();
}
