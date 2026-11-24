import { addDays, type DateString, istDate } from '@/lib/dates';

/**
 * Apple Health adapter (PRD F21). The HealthKit module is native and only
 * exists in a development build; Expo Go doesn't ship it, so it is loaded
 * lazily and every failure means "unavailable" (manual entry instead).
 */
export type HealthApi = {
  available: () => boolean;
  authorize: () => Promise<boolean>;
  /** Steps per calendar day (IST) for the last `days` days including today. */
  stepsByDay: (days: number, now: number) => Promise<Map<DateString, number>>;
};

const STEP = 'HKQuantityTypeIdentifierStepCount';

/** Day buckets from HealthKit → IST date → whole steps. */
export function bucketsToDays(
  buckets: readonly { startDate?: Date | string; sumQuantity?: { quantity: number } }[],
  from: DateString,
  to: DateString,
): Map<DateString, number> {
  const out = new Map<DateString, number>();
  for (let d = from; d <= to; d = addDays(d, 1)) out.set(d, 0);
  for (const b of buckets) {
    if (!b.startDate) continue;
    const date = istDate(b.startDate);
    if (out.has(date)) out.set(date, Math.round(b.sumQuantity?.quantity ?? 0));
  }
  return out;
}

/** Midnight IST of a date, as an instant. */
const istMidnight = (date: DateString) => new Date(`${date}T00:00:00+05:30`);

type HealthKitModule = typeof import('@kingstinct/react-native-healthkit');
type Loader = () => Promise<HealthKitModule>;

/** Lazy so Expo Go (no native module) never evaluates it at startup. */
let loader: Loader = () => import('@kingstinct/react-native-healthkit');
let cached: Promise<HealthApi | null> | null = null;

/** The HealthKit adapter, or null when this build has no HealthKit (Expo Go, Android). */
export function loadHealth(): Promise<HealthApi | null> {
  cached ??= (async () => {
    try {
      const hk = await loader();
      if (!hk.isHealthDataAvailable()) return null;
      return {
        available: () => true,
        authorize: () => hk.requestAuthorization({ toRead: [STEP] }),
        stepsByDay: async (days, now) => {
          const to = istDate(now);
          const from = addDays(to, -(days - 1));
          const buckets = await hk.queryStatisticsCollectionForQuantity(
            STEP,
            ['cumulativeSum'],
            istMidnight(from),
            { day: 1 },
            {
              filter: { date: { startDate: istMidnight(from), endDate: new Date(now) } },
              unit: 'count',
            },
          );
          return bucketsToDays(buckets, from, to);
        },
      };
    } catch {
      return null;
    }
  })();
  return cached;
}

/** Tests only: forget the loaded adapter and optionally swap the module loader. */
export const resetHealth = (next?: Loader) => {
  cached = null;
  if (next) loader = next;
};
