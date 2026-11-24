import {
  type BlockLike,
  fieldsFromProfile,
  firstMondayOnOrAfter,
  hhmm,
  planOnboarding,
  planProfileSave,
  type ProfileRowLike,
  wakeBlockWrites,
  weightWrite,
} from '../lib/plan';
import type { ProfileFields } from '../lib/targets';

const PROFILE: ProfileRowLike = {
  client_id: 'profile-c',
  height_cm: 170,
  start_weight_kg: 91,
  goal_weight_kg: 75,
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
  activity_factor: 1.4,
  weigh_in_mode: 'daily',
  steps_min: 6000,
  monthly_budget_inr: 18000,
};

const FIELDS: ProfileFields = fieldsFromProfile(PROFILE, null);

// Two templates, each with a wake block and other blocks.
const BLOCKS: BlockLike[] = [
  { client_id: 'wd-wake', kind: 'wake', start_time: '05:00:00' },
  { client_id: 'wd-water', kind: 'water', start_time: '05:10:00' },
  { client_id: 'wd-workout', kind: 'workout', start_time: '05:30:00' },
  { client_id: 'we-wake', kind: 'wake', start_time: '05:00:00' },
  { client_id: 'we-sleep', kind: 'sleep', start_time: '22:00:00' },
  {
    client_id: 'old-wake',
    kind: 'wake',
    start_time: '05:00:00',
    deleted_at: '2026-11-01T00:00:00Z',
  },
];

const TEMPLATES = [
  {
    id: 'tpl-workday',
    client_id: 'c1',
    weekdays: [1, 2, 3, 4, 5],
    is_default: true,
    updated_at: '2026-11-01',
  },
  {
    id: 'tpl-weekend',
    client_id: 'c2',
    weekdays: [6, 7],
    is_default: false,
    updated_at: '2026-11-01',
  },
];

const NOW = new Date('2026-11-24T00:10:00Z'); // Tue 05:40 IST
const TODAY = '2026-11-24';

describe('helpers', () => {
  it('hhmm trims seconds', () => expect(hhmm('05:00:00')).toBe('05:00'));

  it('firstMondayOnOrAfter', () => {
    expect(firstMondayOnOrAfter('2026-11-23')).toBe('2026-11-23'); // Monday
    expect(firstMondayOnOrAfter('2026-11-24')).toBe('2026-11-30');
    expect(firstMondayOnOrAfter('2026-11-29')).toBe('2026-11-30'); // Sunday
  });

  it('fieldsFromProfile prefers the latest weight', () => {
    expect(fieldsFromProfile(PROFILE, 90.4).current_weight_kg).toBe(90.4);
    expect(FIELDS).toMatchObject({
      current_weight_kg: 91,
      wake_time: '05:00',
      sleep_time: '22:00',
    });
    expect(
      fieldsFromProfile(
        { ...PROFILE, height_cm: null, start_weight_kg: null, goal_weight_kg: null },
        null,
      ),
    ).toMatchObject({ height_cm: 170, current_weight_kg: 91, goal_weight_kg: 75 });
  });

  it('weightWrite: create, edit, no-op, revive', () => {
    expect(weightWrite(TODAY, 91, null)).toEqual({
      table: 'weight_log',
      row: { date: TODAY, weight_kg: 91 },
    });
    expect(weightWrite(TODAY, 90.5, { client_id: 'w', weight_kg: 91 })).toEqual({
      table: 'weight_log',
      clientId: 'w',
      row: { date: TODAY, weight_kg: 90.5, deleted_at: null },
    });
    expect(weightWrite(TODAY, 91, { client_id: 'w', weight_kg: 91 })).toBeNull();
    expect(
      weightWrite(TODAY, 91, { client_id: 'w', weight_kg: 91, deleted_at: 'x' }),
    ).toMatchObject({
      clientId: 'w',
      row: { deleted_at: null },
    });
  });
});

describe('AC3: wake time moves only the wake block, in every template', () => {
  it('updates the live wake blocks and nothing else', () => {
    expect(wakeBlockWrites(BLOCKS, '05:30')).toEqual([
      { table: 'routine_block', clientId: 'wd-wake', row: { start_time: '05:30' } },
      { table: 'routine_block', clientId: 'we-wake', row: { start_time: '05:30' } },
    ]);
  });

  it('Settings save: only the wake time changed → profile + 2 wake blocks', () => {
    const writes = planProfileSave(
      PROFILE,
      { ...FIELDS, wake_time: '05:30' },
      {
        blocks: BLOCKS,
        today: TODAY,
        todayWeight: { client_id: 'w', weight_kg: 91 },
      },
    );
    expect(writes).toEqual([
      { table: 'profile', clientId: 'profile-c', row: { wake_time: '05:30' } },
      { table: 'routine_block', clientId: 'wd-wake', row: { start_time: '05:30' } },
      { table: 'routine_block', clientId: 'we-wake', row: { start_time: '05:30' } },
    ]);
    const touched = writes.map((w) => w.clientId);
    expect(touched).not.toContain('wd-water');
    expect(touched).not.toContain('wd-workout');
    expect(touched).not.toContain('we-sleep');
  });

  it('sleep / phone-off changes do not move any block', () => {
    const writes = planProfileSave(
      PROFILE,
      { ...FIELDS, sleep_time: '22:30', phone_off_time: '22:00' },
      { blocks: BLOCKS, today: TODAY, todayWeight: { client_id: 'w', weight_kg: 91 } },
    );
    expect(writes).toEqual([
      {
        table: 'profile',
        clientId: 'profile-c',
        row: { sleep_time: '22:30', phone_off_time: '22:00' },
      },
    ]);
  });

  it('no changes → no writes', () => {
    expect(
      planProfileSave(PROFILE, FIELDS, {
        blocks: BLOCKS,
        today: TODAY,
        todayWeight: { client_id: 'w', weight_kg: 91 },
      }),
    ).toEqual([]);
  });

  it('an untouched weight is not re-logged when nothing is logged today', () => {
    expect(planProfileSave(PROFILE, FIELDS, { blocks: [], today: TODAY })).toEqual([]);
    expect(
      planProfileSave(PROFILE, fieldsFromProfile(PROFILE, 90.4), {
        blocks: [],
        today: TODAY,
        latestWeightKg: 90.4,
      }),
    ).toEqual([]);
  });

  it('a new current weight logs today’s weight', () => {
    expect(
      planProfileSave(
        PROFILE,
        { ...FIELDS, current_weight_kg: 90.2 },
        { blocks: BLOCKS, today: TODAY },
      ),
    ).toEqual([{ table: 'weight_log', row: { date: TODAY, weight_kg: 90.2 } }]);
  });
});

describe('AC1: completing onboarding', () => {
  const fields = { ...FIELDS, current_weight_kg: 90.8, goal_weight_kg: 76, kcal_target: 2000 };

  it('sets onboarded_at, logs the first weight, creates today’s day_log, starts the program', () => {
    const writes = planOnboarding(PROFILE, fields, {
      now: NOW,
      today: TODAY,
      blocks: BLOCKS,
      templates: TEMPLATES,
      todayDayLog: null,
      todayWeight: null,
      program: { client_id: 'prog', start_date: '2026-11-23', is_active: true },
    });
    expect(writes).toEqual([
      {
        table: 'profile',
        clientId: 'profile-c',
        row: {
          goal_weight_kg: 76,
          kcal_target: 2000,
          start_weight_kg: 90.8,
          onboarded_at: NOW.toISOString(),
        },
      },
      { table: 'weight_log', row: { date: TODAY, weight_kg: 90.8 } },
      { table: 'day_log', row: { date: TODAY, template_id: 'tpl-workday', deleted_at: null } },
      { table: 'workout_program', clientId: 'prog', row: { start_date: '2026-11-30' } },
    ]);
  });

  it('reuses today’s rows instead of duplicating them, revives a deleted day_log', () => {
    const writes = planOnboarding(PROFILE, FIELDS, {
      now: NOW,
      today: TODAY,
      blocks: BLOCKS,
      templates: TEMPLATES,
      todayDayLog: { client_id: 'dl', deleted_at: '2026-11-24T01:00:00Z' },
      todayWeight: { client_id: 'w', weight_kg: 91 },
      program: { client_id: 'prog', start_date: '2026-11-30', is_active: true },
    });
    expect(writes.map((w) => w.table)).toEqual(['profile', 'day_log']);
    expect(writes[1]).toEqual({
      table: 'day_log',
      clientId: 'dl',
      row: { date: TODAY, template_id: 'tpl-workday', deleted_at: null },
    });
  });

  it('keeps a live day_log, handles no program and no templates', () => {
    const writes = planOnboarding(
      PROFILE,
      { ...FIELDS, wake_time: '04:45' },
      {
        now: NOW,
        today: '2026-11-28', // Saturday
        blocks: BLOCKS,
        templates: [],
        todayDayLog: { client_id: 'dl' },
        todayWeight: null,
        program: null,
      },
    );
    expect(writes.map((w) => w.table)).toEqual([
      'profile',
      'weight_log',
      'routine_block',
      'routine_block',
    ]);
  });

  it('weekend day gets the Weekend template', () => {
    const writes = planOnboarding(PROFILE, FIELDS, {
      now: NOW,
      today: '2026-11-28',
      blocks: [],
      templates: TEMPLATES,
      todayWeight: { client_id: 'w', weight_kg: 91 },
    });
    expect(writes.find((w) => w.table === 'day_log')?.row.template_id).toBe('tpl-weekend');
  });
});
