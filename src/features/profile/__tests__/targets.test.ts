import {
  bodySummary,
  checkDay,
  energyPlan,
  formatDuration,
  monthYear,
  type ProfileFields,
  roughDate,
} from '../lib/targets';

const F: ProfileFields = {
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
};
const PTR = { sex: 'male' as const, birthYear: 1997, activityFactor: 1.4 };
const TODAY = '2026-11-23';

describe('roughDate / monthYear', () => {
  it.each([
    ['2027-07-05', 'early Jul 2027'],
    ['2027-07-15', 'mid Jul 2027'],
    ['2027-07-31', 'late Jul 2027'],
  ])('%s → %s', (d, s) => expect(roughDate(d)).toBe(s));
  it('monthYear', () => expect(monthYear('2027-11-02')).toBe('Nov 2027'));
});

describe('bodySummary (Onboarding 1)', () => {
  it('matches the design: 16.0 kg to lose, BMI 31.5 → 26.0, 32 weeks, early Jul 2027', () => {
    expect(bodySummary(F, TODAY)).toEqual({
      toLoseKg: 16,
      bmiNow: 31.5,
      bmiGoal: 26,
      weeks: 32,
      eta: 'early Jul 2027',
    });
  });

  it('nothing to lose → no timeline', () => {
    expect(bodySummary({ ...F, goal_weight_kg: 95 }, TODAY)).toMatchObject({
      weeks: null,
      eta: null,
    });
  });
});

describe('energyPlan (Onboarding 3)', () => {
  it('PTR defaults: ~2,550 maintenance, ~350 deficit ≈ 0.3 kg/week, 1.65 g/kg', () => {
    expect(energyPlan(F, PTR, TODAY)).toEqual({
      maintenance: 2550,
      deficit: 350,
      kgPerWeek: 0.3,
      goalMonth: 'Oct 2027',
      suggestedKcal: 2000,
      proteinPerKg: 1.65,
    });
  });

  it('no suggestion once the target already gives ~0.5 kg/week', () => {
    expect(energyPlan({ ...F, kcal_target: 2000 }, PTR, TODAY).suggestedKcal).toBeNull();
  });

  it('a surplus has no goal date', () => {
    const p = energyPlan({ ...F, kcal_target: 3000 }, PTR, TODAY);
    expect(p.deficit).toBeLessThan(0);
    expect(p.goalMonth).toBeNull();
  });

  it('a gain goal never suggests eating less', () => {
    expect(energyPlan({ ...F, goal_weight_kg: 95 }, PTR, TODAY).suggestedKcal).toBeNull();
  });
});

describe('checkDay (Onboarding 2)', () => {
  it('design defaults: 7 h 0 min sleep, phone-off 30 min before', () => {
    expect(checkDay(F)).toEqual({ sleepWindowMin: 420, phoneOffBeforeSleepMin: 30, error: null });
  });

  it('handles sleep after midnight', () => {
    expect(
      checkDay({ ...F, phone_off_time: '00:00', sleep_time: '00:30', wake_time: '07:00' }),
    ).toMatchObject({
      sleepWindowMin: 390,
      phoneOffBeforeSleepMin: 30,
      error: null,
    });
  });

  it.each([
    [{ wake_time: '22:00' }, 'Wake and sleep can’t be the same time.'],
    [{ wake_time: '01:00' }, 'That leaves under 4 hours of sleep.'],
    [{ phone_off_time: '22:30' }, 'Phone-off should be shortly before sleep.'],
    [{ phone_off_time: '12:00' }, 'Phone-off should be shortly before sleep.'],
  ])('%p → error', (patch, error) => {
    expect(checkDay({ ...F, ...patch }).error).toBe(error);
  });

  it('formatDuration', () => {
    expect(formatDuration(420)).toBe('7 h 0 min');
    expect(formatDuration(30)).toBe('30 min');
    expect(formatDuration(95)).toBe('1 h 35 min');
  });
});
