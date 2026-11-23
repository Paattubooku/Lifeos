/**
 * Turns onboarding / profile edits into queued writes (PRD F03). Pure: the
 * caller passes the current rows; every write goes through the sync queue.
 */
import { templateForDate, type TemplateLike } from '@/features/routine/lib/templates';
import { addDays, type DateString, isoWeekday } from '@/lib/dates';
import type { Row, SyncTable } from '@/lib/sync';

import type { ProfileFields } from './targets';

export type Write = { table: SyncTable; row: Row; clientId?: string };

export type ProfileRowLike = {
  client_id: string;
  height_cm: number | null;
  start_weight_kg: number | null;
  goal_weight_kg: number | null;
  wake_time: string;
  sleep_time: string;
  phone_off_time: string;
  water_target_ml: number;
  kcal_target: number;
  protein_target_g: number;
  coffee_limit: number;
  onboarded_at: string | null;
};

export type BlockLike = {
  client_id: string;
  kind: string;
  start_time: string;
  deleted_at?: string | null;
};
export type DatedRowLike = { client_id: string; deleted_at?: string | null };
export type WeightRowLike = DatedRowLike & { weight_kg: number };
export type ProgramLike = {
  client_id: string;
  start_date: string | null;
  is_active: boolean;
  deleted_at?: string | null;
};

/** Postgres returns 'HH:mm:ss'; the app uses 'HH:mm'. */
export const hhmm = (t: string) => t.slice(0, 5);

const PROFILE_KEYS = [
  'height_cm',
  'goal_weight_kg',
  'wake_time',
  'sleep_time',
  'phone_off_time',
  'water_target_ml',
  'kcal_target',
  'protein_target_g',
  'coffee_limit',
] as const;

function changedProfileFields(profile: ProfileRowLike, f: ProfileFields): Row {
  const row: Row = {};
  for (const key of PROFILE_KEYS) {
    const current = profile[key];
    const next = f[key];
    const same =
      typeof next === 'string' && typeof current === 'string'
        ? hhmm(current) === next
        : current === next;
    if (!same) row[key] = next;
  }
  return row;
}

/**
 * AC3: block times are absolute. A new wake time moves only the `wake` block in
 * every template; nothing else shifts.
 */
export function wakeBlockWrites(blocks: readonly BlockLike[], wakeTime: string): Write[] {
  return blocks
    .filter((b) => b.kind === 'wake' && !b.deleted_at && hhmm(b.start_time) !== wakeTime)
    .map((b) => ({ table: 'routine_block', clientId: b.client_id, row: { start_time: wakeTime } }));
}

/**
 * One weight per logical day (unique user+date, soft-deleted rows included):
 * edit today's row if it exists — reviving it if it was deleted — else create it.
 */
export function weightWrite(
  today: DateString,
  weightKg: number,
  todayWeight: WeightRowLike | null | undefined,
): Write | null {
  if (!todayWeight) return { table: 'weight_log', row: { date: today, weight_kg: weightKg } };
  if (!todayWeight.deleted_at && Number(todayWeight.weight_kg) === weightKg) return null;
  return {
    table: 'weight_log',
    clientId: todayWeight.client_id,
    row: { date: today, weight_kg: weightKg, deleted_at: null },
  };
}

/** First Monday on or after `date` (program start, PRD §6.4). */
export function firstMondayOnOrAfter(date: DateString): DateString {
  return addDays(date, (8 - isoWeekday(date)) % 7);
}

/** Settings → Profile save. */
export function planProfileSave(
  profile: ProfileRowLike,
  fields: ProfileFields,
  ctx: {
    blocks: readonly BlockLike[];
    today: DateString;
    todayWeight?: WeightRowLike | null;
    /** Latest logged weight the form was seeded with; an untouched weight is not re-logged. */
    latestWeightKg?: number | null;
  },
): Write[] {
  const writes: Write[] = [];
  const changed = changedProfileFields(profile, fields);
  if (Object.keys(changed).length > 0)
    writes.push({ table: 'profile', clientId: profile.client_id, row: changed });
  const shownWeight = fieldsFromProfile(profile, ctx.latestWeightKg ?? null).current_weight_kg;
  if (fields.current_weight_kg !== shownWeight) {
    const weight = weightWrite(ctx.today, fields.current_weight_kg, ctx.todayWeight);
    if (weight) writes.push(weight);
  }
  writes.push(...wakeBlockWrites(ctx.blocks, fields.wake_time));
  return writes;
}

/**
 * AC1: finishing onboarding sets profile.onboarded_at, logs the first weight,
 * creates today's day_log (with today's template) and starts the program on the
 * next Monday.
 */
export function planOnboarding(
  profile: ProfileRowLike,
  fields: ProfileFields,
  ctx: {
    now: Date;
    today: DateString;
    blocks: readonly BlockLike[];
    templates: readonly (TemplateLike & { client_id: string })[];
    todayDayLog?: DatedRowLike | null;
    todayWeight?: WeightRowLike | null;
    program?: ProgramLike | null;
  },
): Write[] {
  const writes: Write[] = [
    {
      table: 'profile',
      clientId: profile.client_id,
      row: {
        ...changedProfileFields(profile, fields),
        start_weight_kg: fields.current_weight_kg,
        onboarded_at: ctx.now.toISOString(),
      },
    },
  ];

  const weight = weightWrite(ctx.today, fields.current_weight_kg, ctx.todayWeight);
  if (weight) writes.push(weight);

  if (!ctx.todayDayLog || ctx.todayDayLog.deleted_at) {
    const template = templateForDate(ctx.templates, ctx.today);
    writes.push({
      table: 'day_log',
      // Revive a soft-deleted row: (user_id, date) is unique even for deleted rows.
      ...(ctx.todayDayLog ? { clientId: ctx.todayDayLog.client_id } : {}),
      row: { date: ctx.today, template_id: template?.id ?? null, deleted_at: null },
    });
  }

  writes.push(...wakeBlockWrites(ctx.blocks, fields.wake_time));

  const program = ctx.program && !ctx.program.deleted_at ? ctx.program : null;
  const start = firstMondayOnOrAfter(ctx.today);
  if (program && program.start_date !== start) {
    writes.push({
      table: 'workout_program',
      clientId: program.client_id,
      row: { start_date: start },
    });
  }
  return writes;
}

/** Form values from a profile row (+ latest weight), for onboarding defaults and Settings. */
export function fieldsFromProfile(
  profile: ProfileRowLike,
  latestWeightKg: number | null,
): ProfileFields {
  return {
    height_cm: profile.height_cm ?? 170,
    current_weight_kg: Number(latestWeightKg ?? profile.start_weight_kg ?? 91),
    goal_weight_kg: Number(profile.goal_weight_kg ?? 75),
    wake_time: hhmm(profile.wake_time),
    phone_off_time: hhmm(profile.phone_off_time),
    sleep_time: hhmm(profile.sleep_time),
    water_target_ml: profile.water_target_ml,
    kcal_target: profile.kcal_target,
    protein_target_g: profile.protein_target_g,
    coffee_limit: profile.coffee_limit,
  };
}
