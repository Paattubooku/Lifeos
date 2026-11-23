/**
 * Energy maths (PRD F13; used from F03 for target hints).
 * BMR by Mifflin-St Jeor, TDEE = BMR × activity factor (default 1.4, DESIGN_NOTES A12).
 */

export const KCAL_PER_KG = 7700;

export type Sex = 'male' | 'female';

export function ageFromBirthYear(birthYear: number, currentYear: number): number {
  return currentYear - birthYear;
}

/** Mifflin-St Jeor: male 10w + 6.25h − 5a + 5, female … − 161. Rounded to whole kcal. */
export function bmr(p: { sex: Sex; weightKg: number; heightCm: number; age: number }): number {
  const base = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age;
  return Math.round(base + (p.sex === 'male' ? 5 : -161));
}

export function tdee(bmrKcal: number, activityFactor: number): number {
  return Math.round(bmrKcal * activityFactor);
}

/** BMI to one decimal. */
export function bmi(weightKg: number, heightCm: number): number {
  const m = heightCm / 100;
  return Math.round((weightKg / (m * m)) * 10) / 10;
}

/** kg per week lost at a daily deficit (negative = gain). */
export function kgPerWeekFromDeficit(deficitKcalPerDay: number): number {
  return (deficitKcalPerDay * 7) / KCAL_PER_KG;
}

/** Daily kcal deficit for a weekly loss rate. */
export function deficitForKgPerWeek(kgPerWeek: number): number {
  return (kgPerWeek * KCAL_PER_KG) / 7;
}

export const roundTo = (n: number, step: number) => Math.round(n / step) * step;

// ---------------------------------------------------------------------------
// F13 energy card (DESIGN_NOTES A12)
// ---------------------------------------------------------------------------

export type EnergyZone = 'small' | 'target' | 'aggressive' | 'surplus';

/** < 300 too small · 300–700 on target · > 700 too aggressive (A12). */
export function energyZone(deficit: number): EnergyZone {
  if (deficit < 0) return 'surplus';
  if (deficit < 300) return 'small';
  if (deficit <= 700) return 'target';
  return 'aggressive';
}

export const ZONE_LABEL: Record<EnergyZone, string> = {
  small: 'Too small',
  target: 'On target',
  aggressive: 'Too aggressive',
  surplus: 'Surplus',
};

/** The one-line read-out with its fix (Prog-Energy design copy, PTR's plan foods). */
export function energyLine(deficit: number): string {
  const kg = Math.round(kgPerWeekFromDeficit(Math.max(deficit, 0)) * 100) / 100;
  switch (energyZone(deficit)) {
    case 'surplus':
      return `${-deficit} kcal over TDEE today. Back to the plan tomorrow.`;
    case 'small':
      return `${deficit} kcal ≈ ${kg} kg/week. Cut ~${roundTo(400 - deficit, 50)} kcal: drop 1 chapati and the peanuts.`;
    case 'target':
      return `${deficit} kcal ≈ ${kg} kg/week. Keep it here.`;
    default:
      return `${deficit} kcal ≈ ${kg} kg/week. Expect muscle loss and a rebound binge. Eat ~${roundTo(deficit - 600, 50)} kcal more: put the snack back.`;
  }
}

/** Measured TDEE needs 28 days with ≥ 20 weigh-ins and ≥ 20 food-logged days (A12). */
export const MEASURED_MIN = { days: 28, weighIns: 20, foodDays: 20 } as const;

/** avg intake + (−trend kg/day × 7,700). */
export function measuredTdee(avgIntake: number, slopeKgPerDay: number): number {
  return Math.round(avgIntake - slopeKgPerDay * KCAL_PER_KG);
}
