import { blocksOf } from '@/features/routine/lib/blocks';
import { istClock, logicalMoment } from '@/lib/dates';
import { seedRoutine } from '@/test/routineFixtures';

import {
  buildSchedule,
  countFor,
  DAILY_CAP,
  type DayInput,
  dayCandidates,
  nextDate,
  REMINDER_TYPES,
  type ScheduleInput,
  waterCopy,
} from '../schedule';

const MON = '2026-11-23';
const TUE = '2026-11-24';
const { blocks } = seedRoutine();
const workday = blocksOf(blocks, 'workday');
const rest = blocksOf(blocks, 'rest');

const ALL_ON = Object.fromEntries(REMINDER_TYPES.map((t) => [t, true])) as ScheduleInput['enabled'];
const PROFILE = {
  wake_time: '05:00:00',
  phone_off_time: '21:30:00',
  water_target_ml: 3000,
  weigh_in_mode: 'daily',
  weigh_in_weekday: 1,
};
const MEALS = {
  breakfast: 'Idli + Sambar + Boiled eggs',
  lunch: 'Ponni rice + Chicken curry + Vegetable poriyal + Curd',
  snack: 'Sundal + Banana + Peanuts + Buttermilk',
  dinner: 'Chapati + Fish curry + Salad',
};
const day = (date: string, over: Partial<DayInput> = {}): DayInput => ({
  date,
  blocks: workday,
  session: { title: 'Upper A', kind: 'strength' },
  mealDishes: MEALS,
  loggedSlots: new Set(),
  waterMl: 0,
  score: null,
  ...over,
});
const input = (over: Partial<ScheduleInput> = {}): ScheduleInput => ({
  now: logicalMoment(MON, '04:00'),
  days: [day(MON), day(TUE)],
  profile: PROFILE,
  enabled: ALL_ON,
  quietDate: null,
  ...over,
});
const clock = (ms: number) => istClock(ms);

describe('F15 AC1: a workday', () => {
  it('≤ 10 reminders per day, in time order, the important ones kept', () => {
    const s = buildSchedule(input());
    const mon = s.filter((r) => r.date === MON);
    expect(mon).toHaveLength(DAILY_CAP);
    expect(mon.map((r) => r.at)).toEqual([...mon.map((r) => r.at)].sort((a, b) => a - b));
    expect(mon.map((r) => [clock(r.at), r.type, r.title])).toEqual([
      ['05:00', 'block', 'Good morning'],
      ['05:15', 'weigh_in', 'Weigh in'],
      ['05:25', 'workout', 'Upper A in 5 min'],
      ['07:00', 'meals', 'Breakfast: Idli + Sambar + Boiled eggs'],
      ['07:30', 'block', 'Pack lunch box'],
      ['13:00', 'meals', 'Lunch: Ponni rice + Chicken curry + Vegetable poriyal + Curd'],
      ['16:30', 'meals', 'Snack: Sundal + Banana + Peanuts + Buttermilk'],
      ['20:00', 'meals', 'Dinner: Chapati + Fish curry + Salad'],
      ['21:30', 'phone_off', 'Phone away'],
      ['22:00', 'block', 'Lights out'],
    ]);
    // Water checks are the lowest priority: all dropped at the cap on a full workday.
    expect(
      dayCandidates(day(MON), input()).filter((r) => r.type === 'water').length,
    ).toBeGreaterThan(0);
    expect(mon.some((r) => r.type === 'water')).toBe(false);
    expect(s.filter((r) => r.date === TUE)).toHaveLength(DAILY_CAP);
    expect(countFor(s, MON)).toBe(10);
  });

  it('deep links', () => {
    const byType = new Map(
      buildSchedule(input())
        .filter((r) => r.date === MON)
        .map((r) => [r.id.split(':').slice(1).join(':'), r.url]),
    );
    expect(byType.get('wake')).toBe('/today');
    expect(byType.get('meal:lunch')).toBe('/meal/lunch');
    expect(byType.get('workout')).toBe(`/session/${MON}`);
    expect(byType.get('phone_off')).toBe('/today');
  });
});

describe('F15 AC2: logging breakfast before 07:00 cancels the 07:00 reminder', () => {
  it('drops the meal reminder; the freed slot goes to the next priority', () => {
    const before = buildSchedule(input({ now: logicalMoment(MON, '06:30') }));
    expect(before.some((r) => r.id === `${MON}:meal:breakfast`)).toBe(true);
    const after = buildSchedule(
      input({
        now: logicalMoment(MON, '06:30'),
        days: [day(MON, { loggedSlots: new Set(['breakfast']) })],
      }),
    );
    expect(after.some((r) => r.id === `${MON}:meal:breakfast`)).toBe(false);
  });
});

describe('rules', () => {
  it('only future reminders; quiet today mutes the whole logical day only', () => {
    const s = buildSchedule(input({ now: logicalMoment(MON, '13:30') }));
    expect(s.filter((r) => r.date === MON).every((r) => r.at > logicalMoment(MON, '13:30'))).toBe(
      true,
    );
    const quiet = buildSchedule(input({ quietDate: MON }));
    expect(quiet.some((r) => r.date === MON)).toBe(false);
    expect(quiet.some((r) => r.date === TUE)).toBe(true);
  });

  it('per-type switches', () => {
    const off = (t: keyof ScheduleInput['enabled']) =>
      buildSchedule(input({ enabled: { ...ALL_ON, [t]: false } }));
    expect(off('meals').some((r) => r.type === 'meals')).toBe(false);
    expect(off('workout').some((r) => r.type === 'workout')).toBe(false);
    expect(off('phone_off').some((r) => r.type === 'phone_off')).toBe(false);
    expect(off('weigh_in').some((r) => r.type === 'weigh_in')).toBe(false);
    expect(off('block').some((r) => r.type === 'block')).toBe(false);
  });

  it('water checks: only when ≥ 300 ml behind assuming no more water; copy by urgency', () => {
    const lean = { ...ALL_ON, block: false, meals: false, weigh_in: false };
    const behind = buildSchedule(input({ enabled: lean, days: [day(MON)] })).filter(
      (r) => r.type === 'water',
    );
    expect(behind.map((r) => clock(r.at))).toEqual([
      '09:00',
      '10:30',
      '12:00',
      '13:30',
      '15:00',
      '16:30',
      '18:00',
      '19:30',
    ]);
    expect(behind[0]).toMatchObject({ title: 'Water: 750 ml behind', url: '/water' });
    // 1,600 ml already by morning: on pace until the 13:30 check (expected 1,594 + 300).
    const ahead = buildSchedule(
      input({ enabled: lean, days: [day(MON, { waterMl: 1600 })] }),
    ).filter((r) => r.type === 'water');
    expect(ahead.map((r) => clock(r.at))).toEqual(['16:30', '18:00', '19:30']);
    expect(waterCopy('low', 300, 300).body).toBe('A quick 300 ml keeps you on pace.');
    expect(waterCopy('medium', 450, 450).body).toBe('Drink a full glass — 450 ml — now.');
    expect(waterCopy('high', 900, 500).title).toBe('Water: 900 ml behind');
  });

  it('no workout reminder on rest/walk days or without a session; no water checks without a water block', () => {
    const rd = buildSchedule(
      input({ days: [day(MON, { blocks: rest, session: { title: 'Rest', kind: 'rest' } })] }),
    );
    expect(rd.some((r) => r.type === 'workout')).toBe(false);
    const none = dayCandidates(day(MON, { session: null }), input());
    expect(none.some((r) => r.type === 'workout')).toBe(false);
    const dry = dayCandidates(
      day(MON, { blocks: workday.filter((b) => b.kind !== 'water') }),
      input(),
    );
    expect(dry.some((r) => r.type === 'water')).toBe(false);
  });

  it('weigh-in: daily, or only on the weigh-in weekday', () => {
    const weekly = { ...PROFILE, weigh_in_mode: 'weekly', weigh_in_weekday: 2 };
    const s = buildSchedule(input({ profile: weekly }));
    expect(s.filter((r) => r.type === 'weigh_in').map((r) => r.date)).toEqual([TUE]);
  });

  it('phone-away body carries the score; meals without known dishes use the block title', () => {
    const s = buildSchedule(input({ days: [day(MON, { score: 78, mealDishes: {} })] }));
    expect(s.find((r) => r.type === 'phone_off')?.body).toBe(
      'Today so far: 78%. Charger in the hall.',
    );
    expect(s.find((r) => r.id === `${MON}:meal:lunch`)?.title).toBe('Lunch');
    expect(nextDate(MON)).toBe(TUE);
  });
});

describe('F20: Sunday 20:00 weekly review', () => {
  const SUN = '2026-11-29';
  const sunday = (over: Partial<ScheduleInput> = {}) =>
    buildSchedule(input({ now: logicalMoment(SUN, '12:00'), days: [day(SUN)], ...over }));
  it('on Sundays at 20:00, opening /review', () => {
    const r = sunday().find((x) => x.type === 'review');
    expect(r).toMatchObject({ id: `${SUN}:review`, title: 'Weekly review', url: '/review' });
    expect(clock(r!.at)).toBe('20:00');
    expect(buildSchedule(input()).some((x) => x.type === 'review')).toBe(false);
  });
  it('dropped once the week is reviewed, or when switched off; old settings default on', () => {
    expect(
      sunday({ reviewedWeeks: new Set(['2026-11-23']) }).some((x) => x.type === 'review'),
    ).toBe(false);
    expect(sunday({ enabled: { ...ALL_ON, review: false } }).some((x) => x.type === 'review')).toBe(
      false,
    );
    const { review: _drop, ...old } = ALL_ON;
    expect(
      sunday({ enabled: old as ScheduleInput['enabled'] }).some((x) => x.type === 'review'),
    ).toBe(true);
  });
});

describe('F24: failure interrupt notification', () => {
  it('high priority: kept at the 10-a-day cap, water checks drop first; can be switched off', () => {
    const s = buildSchedule(input({ days: [day(MON, { interruptAt: '13:00' })] }));
    const mon = s.filter((r) => r.date === MON);
    expect(mon).toHaveLength(DAILY_CAP);
    expect(mon.find((r) => r.type === 'interrupt')).toMatchObject({
      title: 'Do ONE thing now',
      url: '/today',
    });
    expect(clock(mon.find((r) => r.type === 'interrupt')!.at)).toBe('13:00');
    expect(mon.some((r) => r.type === 'water')).toBe(false);
    const off = buildSchedule(
      input({
        days: [day(MON, { interruptAt: '13:00' })],
        enabled: { ...ALL_ON, interrupt: false },
      }),
    );
    expect(off.some((r) => r.type === 'interrupt')).toBe(false);
    expect(buildSchedule(input()).some((r) => r.type === 'interrupt')).toBe(false);
  });
});
