import { profileApi } from '@/features/profile/api';
import { type DayLogRef, routineApi } from '@/features/routine/api';
import { addDays } from '@/lib/dates';

import { base, seededStore } from './profileFixtures';
import type { BlockKind, BlockLike } from '@/features/routine/lib/blocks';
import type { TemplateRowLike } from '@/features/routine/lib/changes';

export const tpl = (
  id: string,
  name: string,
  weekdays: number[],
  over: Partial<TemplateRowLike> = {},
): TemplateRowLike => ({
  id,
  client_id: `${id}-c`,
  name,
  weekdays,
  is_default: false,
  sort: 0,
  updated_at: '2026-11-01T00:00:00Z',
  deleted_at: null,
  archived_at: null,
  ...over,
});

const SEED: [string, BlockKind, string, number, string | null, boolean][] = [
  ['Wake up', 'wake', '05:00', 10, null, false],
  ['Drink 500 ml water', 'water', '05:10', 30, null, false],
  ['Workout', 'workout', '05:30', 60, null, false],
  ['Breakfast', 'meal', '07:00', 30, 'breakfast', false],
  ['Pack lunch box', 'custom', '07:30', 15, null, false],
  ['Lunch', 'meal', '13:00', 30, 'lunch', false],
  ['Snack', 'meal', '16:30', 15, 'snack', false],
  ['Evening walk', 'custom', '18:30', 30, null, true],
  ['Dinner', 'meal', '20:00', 30, 'dinner', false],
  ['Water target hit', 'water', '21:00', 30, null, false],
  ['Phone away', 'phone_off', '21:30', 30, null, false],
  ['Lights out', 'sleep', '22:00', 15, null, false],
];

/** PRD §6.2 seed: Workday 12 blocks (11 counted), Weekend without lunch box, Rest day without workout. */
export function seedRoutine() {
  const templates = [
    tpl('workday', 'Workday', [1, 2, 3, 4, 5], { is_default: true, sort: 0 }),
    tpl('weekend', 'Weekend', [6, 7], { sort: 1 }),
    tpl('rest', 'Rest day', [], { sort: 2 }),
  ];
  const blocks: BlockLike[] = [];
  for (const t of templates) {
    SEED.forEach(([title, kind, start, duration, slot, optional], i) => {
      if (t.id === 'weekend' && title === 'Pack lunch box') return;
      if (t.id === 'rest' && kind === 'workout') return;
      blocks.push({
        id: `${t.id}-${i}`,
        client_id: `${t.id}-${i}-c`,
        template_id: t.id,
        title,
        kind,
        start_time: `${start}:00`,
        duration_min: duration,
        ref_slot: slot,
        auto_complete: kind === 'water' || kind === 'workout' || kind === 'meal',
        is_optional: optional,
        notify: !optional,
        sort: i,
        deleted_at: null,
      });
    });
  }
  return { templates, blocks };
}

/**
 * Signed-in, offline store (writes stay queued) with the seeded profile plus
 * the full PRD routine in the RTK Query cache.
 */
export async function routineStore(opts: { dayLogs?: DayLogRef[] } = {}) {
  const { store, today } = await seededStore();
  const { templates, blocks } = seedRoutine();
  const fullTemplates = templates.map((t) => ({
    ...base,
    ...t,
    deleted_at: null,
    archived_at: t.archived_at ?? null,
  }));
  const fullBlocks = blocks.map((b) => ({ ...base, ...b, deleted_at: null }));
  await store.dispatch(
    profileApi.util.upsertQueryData('getRoutine', undefined, {
      templates: fullTemplates,
      blocks: fullBlocks,
    }),
  );
  await store.dispatch(
    routineApi.util.upsertQueryData('getDayLogsSince', addDays(today, -6), opts.dayLogs ?? []),
  );
  return { store, today, templates, blocks };
}
