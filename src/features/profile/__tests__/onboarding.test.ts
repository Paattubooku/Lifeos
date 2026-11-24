import {
  completeFields,
  EXAMPLE,
  fitRoutineWrites,
  fitTime,
  newDraft,
  type OnboardingDraft,
  stepError,
  suggestTargets,
} from '../lib/onboarding';
import type { ProfileRowLike } from '../lib/plan';

const ROW: ProfileRowLike = {
  client_id: 'p',
  height_cm: null,
  start_weight_kg: null,
  goal_weight_kg: null,
  wake_time: '05:00:00',
  sleep_time: '22:00:00',
  phone_off_time: '21:30:00',
  water_target_ml: 3000,
  kcal_target: 2200,
  protein_target_g: 150,
  coffee_limit: 2,
  onboarded_at: null,
  sex: 'male',
  birth_year: 1997,
  activity_factor: '1.40',
  weigh_in_mode: 'daily',
  steps_min: 6000,
  monthly_budget_inr: 18000,
};
const DAY = { wake: '05:00', sleep: '22:00' };
const draft = (over: Partial<OnboardingDraft> = {}): OnboardingDraft => ({
  ...EXAMPLE,
  targetsSuggested: false,
  ...over,
});

describe('newDraft', () => {
  it('a new account starts with blanks for body and age', () => {
    expect(newDraft(ROW, null)).toMatchObject({
      birth_year: null,
      height_cm: null,
      current_weight_kg: null,
      goal_weight_kg: null,
      wake_time: '05:00',
      targetsSuggested: false,
    });
  });
  it('an account with a profile keeps its numbers (latest weight wins)', () => {
    const d = newDraft(
      { ...ROW, height_cm: 160, start_weight_kg: 70, goal_weight_kg: 60, sex: 'female' },
      68,
    );
    expect(d).toMatchObject({
      sex: 'female',
      birth_year: 1997,
      height_cm: 160,
      current_weight_kg: 68,
      goal_weight_kg: 60,
    });
    expect(newDraft({ ...ROW, height_cm: 160, start_weight_kg: 70 }, null).current_weight_kg).toBe(
      70,
    );
  });
});

describe('stepError / completeFields', () => {
  it('step 1 needs a birth year and a height in range', () => {
    expect(stepError(1, draft({ birth_year: null }))).toMatch(/birth year/);
    expect(stepError(1, draft({ height_cm: 99 }))).toMatch(/height/);
    expect(stepError(1, draft())).toBeNull();
  });
  it('step 2 needs both weights; step 3 checks the day; 4–5 always pass', () => {
    expect(stepError(2, draft({ current_weight_kg: null }))).toMatch(/your weight/);
    expect(stepError(2, draft({ goal_weight_kg: 400 }))).toMatch(/goal weight/);
    expect(stepError(3, draft({ sleep_time: '05:00' }))).toMatch(/same time/);
    expect(stepError(4, draft({ height_cm: null }))).toBeNull();
  });
  it('full fields only once steps 1–2 are answered', () => {
    expect(completeFields(draft({ goal_weight_kg: null }))).toBeNull();
    expect(completeFields(draft())).toEqual(EXAMPLE);
  });
});

describe('suggestTargets', () => {
  it('the example person gets the example plan', () => {
    expect(suggestTargets(EXAMPLE, '2026-11-24')).toEqual({
      kcal_target: 2000,
      protein_target_g: 150,
      water_target_ml: 3000,
    });
  });
  it('not losing → maintenance calories; limits respected', () => {
    const t = suggestTargets(
      { ...EXAMPLE, sex: 'female', current_weight_kg: 50, goal_weight_kg: 52, height_cm: 155 },
      '2026-11-24',
    );
    expect(t.protein_target_g).toBe(105);
    expect(t.water_target_ml).toBe(1750);
    expect(t.kcal_target % 50).toBe(0);
    expect(
      suggestTargets({ ...EXAMPLE, current_weight_kg: 20, goal_weight_kg: 20 }, '2026-11-24'),
    ).toMatchObject({ water_target_ml: 750, kcal_target: 1550 });
  });
});

describe('fitTime', () => {
  it('keeps a time at the same place in the day, rounded to 5 min', () => {
    expect(fitTime('13:00:00', DAY, DAY)).toBe('13:00');
    expect(fitTime('05:00', DAY, { wake: '07:00', sleep: '00:00' })).toBe('07:00');
    // 13:00 is 8/17 through 05–22; in 07:00–00:00 (17 h) that is 15:00.
    expect(fitTime('13:00', DAY, { wake: '07:00', sleep: '00:00' })).toBe('15:00');
    // Shorter day 06:30–22:30 (16 h): 8/17 × 960 = 451.8 → 450 min → 14:00.
    expect(fitTime('13:00', DAY, { wake: '06:30', sleep: '22:30' })).toBe('14:00');
    // A night-shift day crosses midnight.
    expect(fitTime('21:00', DAY, { wake: '14:00', sleep: '07:00' })).toBe('06:00');
  });
});

describe('fitRoutineWrites', () => {
  it('wake / phone-off / sleep take the answers, the rest is fitted; meals too; unchanged rows skipped', () => {
    const writes = fitRoutineWrites(
      [
        { client_id: 'w', kind: 'wake', start_time: '05:00:00' },
        { client_id: 'l', kind: 'meal', start_time: '13:00:00' },
        { client_id: 'p', kind: 'phone_off', start_time: '21:30:00' },
        { client_id: 's', kind: 'sleep', start_time: '22:00:00' },
        { client_id: 'x', kind: 'custom', start_time: '09:00:00', deleted_at: 'gone' },
      ],
      [
        { client_id: 'm-l', time: '13:00:00' },
        { client_id: 'm-x', time: '08:00:00', deleted_at: 'gone' },
      ],
      DAY,
      { wake_time: '07:00', phone_off_time: '23:00', sleep_time: '00:00' },
    );
    expect(writes).toEqual([
      { table: 'routine_block', clientId: 'w', row: { start_time: '07:00' } },
      { table: 'routine_block', clientId: 'l', row: { start_time: '15:00' } },
      { table: 'routine_block', clientId: 'p', row: { start_time: '23:00' } },
      { table: 'routine_block', clientId: 's', row: { start_time: '00:00' } },
      { table: 'meal', clientId: 'm-l', row: { time: '15:00' } },
    ]);
    expect(
      fitRoutineWrites(
        [{ client_id: 'w', kind: 'wake', start_time: '05:00:00' }],
        [{ client_id: 'm', time: '07:00:00' }],
        DAY,
        { wake_time: '05:00', phone_off_time: '21:30', sleep_time: '22:00' },
      ),
    ).toEqual([]);
  });
});
