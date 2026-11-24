import { type BlockLike, hhmm } from '@/features/routine/lib/blocks';
import { addDays, type DateString, isoWeekday, logicalMoment } from '@/lib/dates';
import { formatIndianNumber } from '@/lib/format';

import {
  classifyUrgency,
  expectedBy,
  NOTIFY_GAP_ML,
  suggestedAmount,
  type Urgency,
} from '../water/lib/pace';

/** PRD F15: right nudge, right time, at most 10 a logical day. */
export const DAILY_CAP = 10;
/** Water checks: every 90 min (the reference's cooldown, `min_interval_mins`). */
export const WATER_CHECKS = [
  '09:00',
  '10:30',
  '12:00',
  '13:30',
  '15:00',
  '16:30',
  '18:00',
  '19:30',
] as const;
export const WORKOUT_LEAD_MIN = 5;
export const WEIGH_IN_AFTER_WAKE_MIN = 15;
export const REVIEW_AT = '20:00';

export type ReminderType =
  'block' | 'water' | 'workout' | 'meals' | 'phone_off' | 'weigh_in' | 'review';

export const REMINDER_TYPES: readonly ReminderType[] = [
  'block',
  'water',
  'workout',
  'meals',
  'phone_off',
  'weigh_in',
  'review',
];

/** Kept first when over the cap; water checks go first (PRD). */
const PRIORITY: Record<ReminderType | 'wake', number> = {
  phone_off: 10,
  wake: 9,
  workout: 9,
  meals: 8,
  weigh_in: 7,
  review: 8,
  block: 4,
  water: 1,
};

export type Reminder = {
  /** Stable per day + source, e.g. "2026-11-23:meal:breakfast". */
  id: string;
  date: DateString;
  at: number;
  type: ReminderType;
  title: string;
  body: string;
  /** Deep link opened on tap. */
  url: string;
};

export type DayInput = {
  date: DateString;
  /** The date's timeline (template blocks in order). */
  blocks: readonly BlockLike[];
  /** Today's workout session from the program, or null. */
  session: { title: string; kind: string } | null;
  /** Meal slot → "Idli + Sambar + Boiled eggs". */
  mealDishes: Readonly<Record<string, string>>;
  /** Slots with something logged already (their reminder is cancelled). */
  loggedSlots: ReadonlySet<string>;
  /** Water logged so far that day (0 for future days). */
  waterMl: number;
  /** The day's live score, for "Phone away. Today so far: 78%". */
  score: number | null;
};

export type ScheduleInput = {
  now: number;
  days: readonly DayInput[];
  profile: {
    wake_time: string;
    phone_off_time: string;
    water_target_ml: number;
    weigh_in_mode: string;
    weigh_in_weekday: number;
  };
  enabled: Readonly<Record<ReminderType, boolean>>;
  /** Logical day muted with "Quiet today". */
  quietDate: DateString | null;
  /** Weeks (Monday) already reviewed: no Sunday reminder for them (F20). */
  reviewedWeeks?: ReadonlySet<DateString>;
};

const SLOT_NAME: Record<string, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  snack: 'Snack',
  dinner: 'Dinner',
};

/** Blunt water copy per urgency (from My-Tracker `URGENCY_MESSAGES`, shortened, no emoji). */
export function waterCopy(
  urgency: Urgency,
  gap: number,
  suggested: number,
): { title: string; body: string } {
  const g = formatIndianNumber(gap);
  const s = formatIndianNumber(suggested);
  switch (urgency) {
    case 'high':
      return {
        title: `Water: ${g} ml behind`,
        body: `Well behind pace. Drink ${s} ml now, then keep going.`,
      };
    case 'medium':
      return { title: `Water: ${g} ml behind`, body: `Drink a full glass — ${s} ml — now.` };
    default:
      return { title: `Water: ${g} ml behind`, body: `A quick ${s} ml keeps you on pace.` };
  }
}

const minutesOf = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const at = (date: DateString, t: string) => logicalMoment(date, hhmm(t));
const shift = (t: string, by: number) => {
  const m = (((minutesOf(t) + by) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

/** Every candidate reminder for one logical day, before the cap. */
export function dayCandidates(
  day: DayInput,
  input: ScheduleInput,
): (Reminder & { priority: number })[] {
  const { profile, enabled } = input;
  const out: (Reminder & { priority: number })[] = [];
  const add = (r: Omit<Reminder, 'date'>, priority: number) =>
    out.push({ ...r, date: day.date, priority });
  const id = (k: string) => `${day.date}:${k}`;
  const live = day.blocks.filter((b) => !b.deleted_at);
  const waterBlocks = live.filter((b) => b.kind === 'water');
  const target = waterBlocks[waterBlocks.length - 1];

  // Wake: "Good morning. 500 ml water first." (block-start type).
  if (enabled.block)
    add(
      {
        id: id('wake'),
        at: at(day.date, profile.wake_time),
        type: 'block',
        title: 'Good morning',
        body: '500 ml water first.',
        url: '/today',
      },
      PRIORITY.wake,
    );

  for (const b of live) {
    if (!b.notify) continue;
    if (b.kind === 'wake' || b.kind === 'water' || b.kind === 'phone_off') continue; // own reminders / water pace
    if (b.kind === 'workout') {
      if (!enabled.workout || !day.session || !['strength', 'circuit'].includes(day.session.kind))
        continue;
      add(
        {
          id: id('workout'),
          at: at(day.date, shift(hhmm(b.start_time), -WORKOUT_LEAD_MIN)),
          type: 'workout',
          title: `${day.session.title} in ${WORKOUT_LEAD_MIN} min`,
          body: 'Shoes on. Dumbbells out.',
          url: `/session/${day.date}`,
        },
        PRIORITY.workout,
      );
      continue;
    }
    if (b.kind === 'meal') {
      const slot = b.ref_slot ?? '';
      if (!enabled.meals || !slot || day.loggedSlots.has(slot)) continue;
      const dishes = day.mealDishes[slot];
      add(
        {
          id: id(`meal:${slot}`),
          at: at(day.date, b.start_time),
          type: 'meals',
          title: dishes ? `${SLOT_NAME[slot] ?? b.title}: ${dishes}` : b.title,
          body: 'Tick it when eaten.',
          url: `/meal/${slot}`,
        },
        PRIORITY.meals,
      );
      continue;
    }
    if (enabled.block)
      add(
        {
          id: id(`block:${b.client_id}`),
          at: at(day.date, b.start_time),
          type: 'block',
          title: b.title,
          body: 'Starts now.',
          url: '/today',
        },
        PRIORITY.block,
      );
  }

  if (enabled.phone_off)
    add(
      {
        id: id('phone_off'),
        at: at(day.date, profile.phone_off_time),
        type: 'phone_off',
        title: 'Phone away',
        body:
          day.score === null
            ? 'Charger in the hall.'
            : `Today so far: ${day.score}%. Charger in the hall.`,
        url: '/today',
      },
      PRIORITY.phone_off,
    );

  const weighDay =
    profile.weigh_in_mode === 'daily' || isoWeekday(day.date) === profile.weigh_in_weekday;
  if (enabled.weigh_in && weighDay)
    add(
      {
        id: id('weigh_in'),
        at: at(day.date, shift(profile.wake_time, WEIGH_IN_AFTER_WAKE_MIN)),
        type: 'weigh_in',
        title: 'Weigh in',
        body: 'Before breakfast, after the toilet, same scale.',
        url: '/today',
      },
      PRIORITY.weigh_in,
    );

  // F20: Sunday 20:00 weekly review, unless that week is already reviewed.
  // `!== false`: settings saved before F20 have no `review` key (default on).
  if (
    enabled.review !== false &&
    isoWeekday(day.date) === 7 &&
    !input.reviewedWeeks?.has(addDays(day.date, -6))
  )
    add(
      {
        id: id('review'),
        at: at(day.date, REVIEW_AT),
        type: 'review',
        title: 'Weekly review',
        body: 'Two minutes: your week in numbers, one change for next week.',
        url: '/review',
      },
      PRIORITY.review,
    );

  // Water checks: only where, with no more water from now, the gap would be ≥ 300 ml (F07 / A7).
  if (enabled.water && target) {
    const wakeMin = minutesOf(profile.wake_time);
    const targetMin = minutesOf(target.start_time);
    for (const t of WATER_CHECKS) {
      const tm = minutesOf(t);
      if (tm <= wakeMin || tm >= targetMin) continue;
      const gap = expectedBy(tm, wakeMin, targetMin, profile.water_target_ml) - day.waterMl;
      if (gap < NOTIFY_GAP_ML) continue;
      const copy = waterCopy(classifyUrgency(gap), gap, suggestedAmount(gap));
      add(
        { id: id(`water:${t}`), at: at(day.date, t), type: 'water', ...copy, url: '/water' },
        PRIORITY.water,
      );
    }
  }
  return out;
}

/**
 * The next days' reminders: future only, quiet day muted, at most 10 per
 * logical day (lowest priority dropped first), in time order.
 */
export function buildSchedule(input: ScheduleInput): Reminder[] {
  const out: Reminder[] = [];
  for (const day of input.days) {
    if (input.quietDate === day.date) continue;
    const upcoming = dayCandidates(day, input).filter((r) => r.at > input.now);
    const kept = [...upcoming]
      .sort((a, b) => b.priority - a.priority || a.at - b.at)
      .slice(0, DAILY_CAP)
      .sort((a, b) => a.at - b.at);
    out.push(...kept.map(({ priority: _p, ...r }) => r));
  }
  return out.sort((a, b) => a.at - b.at);
}

/** How many are scheduled for a day (Reminders screen: "7 of 10"). */
export const countFor = (rs: readonly Reminder[], date: DateString) =>
  rs.filter((r) => r.date === date).length;

export const nextDate = (d: DateString) => addDays(d, 1);
