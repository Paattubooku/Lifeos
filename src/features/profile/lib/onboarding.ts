/**
 * F25 · first-run setup for any new account. Pure: the screen keeps the
 * answers in the profile slice and calls `planFirstRun` at the end.
 *
 * Every new account starts from the creator's plan (PRD §6 seed). The answers
 * start blank where they are personal (body, age) and show that plan's values
 * as examples ("e.g. 170"); routine and meal times are then fitted to the
 * person's own wake and sleep times.
 */
import { roundTo } from '@/features/body/lib/energy';
import type { DateString } from '@/lib/dates';

import {
  type BlockLike,
  type DatedRowLike,
  hhmm,
  planOnboarding,
  type ProfileRowLike,
  type ProgramLike,
  type WeightRowLike,
  type Write,
} from './plan';
import { checkDay, energyPlan, LIMITS, personOf, type ProfileFields } from './targets';
import type { TemplateLike } from '@/features/routine/lib/templates';

/** The example plan (PRD §2.1 / §6.1): shown as hints, never assumed. */
export const EXAMPLE: ProfileFields = {
  sex: 'male',
  birth_year: 1997,
  activity_factor: 1.4,
  weigh_in_mode: 'daily',
  height_cm: 170,
  current_weight_kg: 91,
  goal_weight_kg: 75,
  wake_time: '05:00',
  phone_off_time: '21:30',
  sleep_time: '22:00',
  water_target_ml: 3000,
  kcal_target: 2200,
  protein_target_g: 150,
  coffee_limit: 2,
  steps_min: 6000,
  monthly_budget_inr: 18000,
};

/** Personal numbers start empty (null) until typed. */
export type BlankKey = 'birth_year' | 'height_cm' | 'current_weight_kg' | 'goal_weight_kg';
export type OnboardingDraft = Omit<ProfileFields, BlankKey> & {
  [K in BlankKey]: number | null;
} & {
  /** Targets are suggested once, when the person first reaches step 4. */
  targetsSuggested: boolean;
};

export const ONBOARDING_STEPS = 5;

/** A fresh draft: blanks for body and age, the example for everything else. */
export function newDraft(profile: ProfileRowLike, latestWeightKg: number | null): OnboardingDraft {
  const known = profile.height_cm !== null;
  return {
    ...EXAMPLE,
    sex: profile.sex === 'female' ? 'female' : 'male',
    birth_year: known ? profile.birth_year : null,
    height_cm: profile.height_cm,
    current_weight_kg:
      latestWeightKg ?? (profile.start_weight_kg === null ? null : Number(profile.start_weight_kg)),
    goal_weight_kg: profile.goal_weight_kg === null ? null : Number(profile.goal_weight_kg),
    targetsSuggested: false,
  };
}

const within = (v: number | null, l: { min: number; max: number }) =>
  v !== null && Number.isFinite(v) && v >= l.min && v <= l.max;

/** Why Continue is disabled on a step, or null. */
export function stepError(step: number, d: OnboardingDraft): string | null {
  if (step === 1) {
    if (!within(d.birth_year, LIMITS.birth_year))
      return `Enter your birth year (${LIMITS.birth_year.min}–${LIMITS.birth_year.max}).`;
    if (!within(d.height_cm, LIMITS.height_cm))
      return `Enter your height in cm (${LIMITS.height_cm.min}–${LIMITS.height_cm.max}).`;
  }
  if (step === 2) {
    if (!within(d.current_weight_kg, LIMITS.weight_kg))
      return `Enter your weight in kg (${LIMITS.weight_kg.min}–${LIMITS.weight_kg.max}).`;
    if (!within(d.goal_weight_kg, LIMITS.weight_kg))
      return `Enter a goal weight in kg (${LIMITS.weight_kg.min}–${LIMITS.weight_kg.max}).`;
  }
  if (step === 3) return checkDay(d).error;
  return null;
}

/** The answers as full profile fields, once steps 1–2 are valid. */
export function completeFields(d: OnboardingDraft): ProfileFields | null {
  if (stepError(1, d) || stepError(2, d)) return null;
  const { targetsSuggested: _t, ...rest } = d;
  return {
    ...rest,
    birth_year: d.birth_year as number,
    height_cm: d.height_cm as number,
    current_weight_kg: d.current_weight_kg as number,
    goal_weight_kg: d.goal_weight_kg as number,
  };
}

const clamp = (v: number, l: { min: number; max: number }) => Math.min(l.max, Math.max(l.min, v));

/**
 * Targets from the answers (same rules as the example plan): calories for
 * ~0.5 kg a week (or maintenance when not losing), protein 2 g per kg of goal
 * weight, water 33 ml per kg rounded to 250 ml.
 */
export function suggestTargets(
  f: ProfileFields,
  today: DateString,
): Pick<ProfileFields, 'kcal_target' | 'protein_target_g' | 'water_target_ml'> {
  const atMaintenance = energyPlan(
    { ...f, kcal_target: LIMITS.kcal_target.max },
    personOf(f),
    today,
  );
  const kcal = atMaintenance.suggestedKcal ?? atMaintenance.maintenance;
  return {
    kcal_target: clamp(kcal, LIMITS.kcal_target),
    protein_target_g: clamp(roundTo(2 * f.goal_weight_kg, 5), LIMITS.protein_target_g),
    water_target_ml: clamp(roundTo(33 * f.current_weight_kg, 250), LIMITS.water_target_ml),
  };
}

const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const toClock = (m: number) => {
  const x = ((m % 1440) + 1440) % 1440;
  return `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`;
};
const span = (from: string, to: string) => (toMin(to) - toMin(from) + 1440) % 1440 || 1440;

/**
 * Moves a time from the example day (wake → sleep) onto the person's day,
 * keeping its place in the day: 13:00 in a 05:00–22:00 day is 47 % through.
 * Rounded to 5 minutes.
 */
export function fitTime(
  t: string,
  from: { wake: string; sleep: string },
  to: { wake: string; sleep: string },
): string {
  const offset = (toMin(hhmm(t)) - toMin(from.wake) + 1440) % 1440;
  const ratio = offset / span(from.wake, from.sleep);
  return toClock(toMin(to.wake) + Math.round((ratio * span(to.wake, to.sleep)) / 5) * 5);
}

export type MealLike = { client_id: string; time: string; deleted_at?: string | null };

/** Routine blocks and meal times fitted to the new wake / phone-off / sleep times. */
export function fitRoutineWrites(
  blocks: readonly BlockLike[],
  meals: readonly MealLike[],
  from: { wake: string; sleep: string },
  f: Pick<ProfileFields, 'wake_time' | 'phone_off_time' | 'sleep_time'>,
): Write[] {
  const to = { wake: f.wake_time, sleep: f.sleep_time };
  const fixed: Record<string, string> = {
    wake: f.wake_time,
    phone_off: f.phone_off_time,
    sleep: f.sleep_time,
  };
  const writes: Write[] = [];
  for (const b of blocks) {
    if (b.deleted_at) continue;
    const next = fixed[b.kind] ?? fitTime(b.start_time, from, to);
    if (next !== hhmm(b.start_time))
      writes.push({ table: 'routine_block', clientId: b.client_id, row: { start_time: next } });
  }
  for (const m of meals) {
    if (m.deleted_at) continue;
    const next = fitTime(m.time, from, to);
    if (next !== hhmm(m.time))
      writes.push({ table: 'meal', clientId: m.client_id, row: { time: next } });
  }
  return writes;
}

/**
 * Finishing first-run setup: everything F03's `planOnboarding` does (profile,
 * first weight, today's day_log, program start), with all the answers saved and
 * the whole routine fitted to the person's day instead of only the wake block.
 */
export function planFirstRun(
  profile: ProfileRowLike,
  f: ProfileFields,
  ctx: {
    now: Date;
    today: DateString;
    blocks: readonly BlockLike[];
    meals: readonly MealLike[];
    templates: readonly (TemplateLike & { client_id: string })[];
    todayDayLog?: DatedRowLike | null;
    todayWeight?: WeightRowLike | null;
    program?: ProgramLike | null;
  },
): Write[] {
  const base = planOnboarding(profile, f, ctx).filter((w) => w.table !== 'routine_block');
  const from = { wake: hhmm(profile.wake_time), sleep: hhmm(profile.sleep_time) };
  return [...base, ...fitRoutineWrites(ctx.blocks, ctx.meals, from, f)];
}
