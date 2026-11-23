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
