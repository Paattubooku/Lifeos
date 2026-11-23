/**
 * Onboarding / profile maths and copy helpers (PRD F03, designs Onboarding-1…4).
 * All pure; dates come in as 'YYYY-MM-DD' so tests are deterministic.
 */
import {
  ageFromBirthYear,
  bmi,
  bmr,
  deficitForKgPerWeek,
  kgPerWeekFromDeficit,
  roundTo,
  type Sex,
  tdee,
} from '@/features/body/lib/energy';
import { addDays, type DateString, parseDate } from '@/lib/dates';
import { parseClock } from '@/lib/format';

export type ProfileFields = {
  height_cm: number;
  current_weight_kg: number;
  goal_weight_kg: number;
  wake_time: string; // 'HH:mm'
  phone_off_time: string;
  sleep_time: string;
  water_target_ml: number;
  kcal_target: number;
  protein_target_g: number;
  coffee_limit: number;
};

export const LIMITS = {
  height_cm: { min: 100, max: 250, step: 1 },
  weight_kg: { min: 20, max: 300, step: 0.1 },
  water_target_ml: { min: 500, max: 10_000, step: 250 },
  kcal_target: { min: 800, max: 6000, step: 50 },
  protein_target_g: { min: 0, max: 400, step: 5 },
  coffee_limit: { min: 0, max: 10, step: 1 },
} as const;

/** Healthy default loss rate the plain-maths line uses. */
export const DEFAULT_KG_PER_WEEK = 0.5;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** '2027-07-06' → 'early Jul 2027' (1–10 early, 11–20 mid, 21+ late). */
export function roughDate(date: DateString): string {
  const d = parseDate(date);
  const day = d.getUTCDate();
  const part = day <= 10 ? 'early' : day <= 20 ? 'mid' : 'late';
  return `${part} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** '2027-11-15' → 'Nov 2027'. */
export function monthYear(date: DateString): string {
  const d = parseDate(date);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export type BodySummary = {
  toLoseKg: number;
  bmiNow: number;
  bmiGoal: number;
  /** Weeks at DEFAULT_KG_PER_WEEK; null when there is nothing to lose. */
  weeks: number | null;
  eta: string | null;
};

export function bodySummary(
  f: Pick<ProfileFields, 'height_cm' | 'current_weight_kg' | 'goal_weight_kg'>,
  today: DateString,
): BodySummary {
  const toLoseKg = Math.round((f.current_weight_kg - f.goal_weight_kg) * 10) / 10;
  const weeks = toLoseKg > 0 ? Math.ceil(toLoseKg / DEFAULT_KG_PER_WEEK) : null;
  return {
    toLoseKg,
    bmiNow: bmi(f.current_weight_kg, f.height_cm),
    bmiGoal: bmi(f.goal_weight_kg, f.height_cm),
    weeks,
    eta: weeks === null ? null : roughDate(addDays(today, weeks * 7)),
  };
}

export type EnergyPlan = {
  /** Estimated maintenance kcal, rounded to 50. */
  maintenance: number;
  /** Daily deficit at the chosen kcal target, rounded to 50 (negative = surplus). */
  deficit: number;
  kgPerWeek: number;
  /** When the goal is reached at this pace ('Nov 2027'), or null if not losing. */
  goalMonth: string | null;
  /** kcal target for ~0.5 kg/week, rounded to 50; null if the current target is already there. */
  suggestedKcal: number | null;
  proteinPerKg: number;
};

export function energyPlan(
  f: Pick<
    ProfileFields,
    'height_cm' | 'current_weight_kg' | 'goal_weight_kg' | 'kcal_target' | 'protein_target_g'
  >,
  person: { sex: Sex; birthYear: number; activityFactor: number },
  today: DateString,
): EnergyPlan {
  const age = ageFromBirthYear(person.birthYear, parseDate(today).getUTCFullYear());
  const t = tdee(
    bmr({ sex: person.sex, weightKg: f.current_weight_kg, heightCm: f.height_cm, age }),
    person.activityFactor,
  );
  const rawDeficit = t - f.kcal_target;
  const kgPerWeek = Math.round(kgPerWeekFromDeficit(rawDeficit) * 10) / 10;
  const toLose = f.current_weight_kg - f.goal_weight_kg;
  const exactRate = kgPerWeekFromDeficit(rawDeficit);
  const goalMonth =
    toLose > 0 && exactRate > 0
      ? monthYear(addDays(today, Math.ceil((toLose / exactRate) * 7)))
      : null;
  const target = roundTo(t - deficitForKgPerWeek(DEFAULT_KG_PER_WEEK), 50);
  return {
    maintenance: roundTo(t, 50),
    deficit: roundTo(rawDeficit, 50),
    kgPerWeek,
    goalMonth,
    suggestedKcal: toLose > 0 && target < f.kcal_target ? target : null,
    proteinPerKg: Math.round((f.protein_target_g / f.current_weight_kg) * 100) / 100,
  };
}

const minutes = (hhmm: string) => {
  const { hours, minutes: m } = parseClock(hhmm);
  return hours * 60 + m;
};
const mod = (n: number) => ((n % 1440) + 1440) % 1440;

export type DayCheck = {
  /** Sleep → wake, minutes. */
  sleepWindowMin: number;
  /** Phone-off → sleep, minutes. */
  phoneOffBeforeSleepMin: number;
  error: string | null;
};

/** Validates step 2; times may cross midnight (e.g. sleep 00:30). */
export function checkDay(
  f: Pick<ProfileFields, 'wake_time' | 'phone_off_time' | 'sleep_time'>,
): DayCheck {
  const wake = minutes(f.wake_time);
  const phone = minutes(f.phone_off_time);
  const sleep = minutes(f.sleep_time);
  const sleepWindowMin = mod(wake - sleep);
  const phoneOffBeforeSleepMin = mod(sleep - phone);
  let error: string | null = null;
  if (wake === sleep) error = 'Wake and sleep can’t be the same time.';
  else if (sleepWindowMin < 4 * 60) error = 'That leaves under 4 hours of sleep.';
  else if (phoneOffBeforeSleepMin > 4 * 60) error = 'Phone-off should be shortly before sleep.';
  return { sleepWindowMin, phoneOffBeforeSleepMin, error };
}

/** 420 → '7 h 0 min'; 30 → '30 min'. */
export function formatDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h} h ${m} min` : `${m} min`;
}
