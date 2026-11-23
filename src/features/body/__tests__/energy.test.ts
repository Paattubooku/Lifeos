import {
  ageFromBirthYear,
  bmi,
  bmr,
  deficitForKgPerWeek,
  kgPerWeekFromDeficit,
  roundTo,
  tdee,
} from '../lib/energy';

describe('energy (PRD F13)', () => {
  it('BMR matches PRD F13 AC3', () => {
    expect(bmr({ sex: 'male', weightKg: 91, heightCm: 170, age: 29 })).toBe(1833);
    expect(bmr({ sex: 'male', weightKg: 88.4, heightCm: 170, age: 29 })).toBe(1807);
    expect(bmr({ sex: 'female', weightKg: 60, heightCm: 160, age: 30 })).toBe(1289);
  });

  it('age = current year − birth year; TDEE = BMR × factor', () => {
    expect(ageFromBirthYear(1997, 2026)).toBe(29);
    expect(tdee(1833, 1.4)).toBe(2566);
  });

  it('BMI, deficit ↔ kg/week, rounding', () => {
    expect(bmi(91, 170)).toBe(31.5);
    expect(bmi(75, 170)).toBe(26);
    expect(kgPerWeekFromDeficit(550)).toBe(0.5);
    expect(deficitForKgPerWeek(0.5)).toBe(550);
    expect(roundTo(2566, 50)).toBe(2550);
    expect(roundTo(2576, 50)).toBe(2600);
  });
});
