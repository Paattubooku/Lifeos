import { formatClock } from '@/lib/format';
import type { Database } from '@/types/supabase';

export type BlockKind = Database['public']['Tables']['routine_block']['Row']['kind'];
export type MealSlot = 'breakfast' | 'lunch' | 'snack' | 'dinner';

/** The design's six kinds (DESIGN_NOTES A18). The DB keeps the PRD enum. */
export type KindGroup = 'habit' | 'water' | 'workout' | 'meal' | 'sleep' | 'task';

export const KIND_GROUPS: readonly { value: KindGroup; label: string }[] = [
  { value: 'habit', label: 'Habit' },
  { value: 'water', label: 'Water' },
  { value: 'workout', label: 'Workout' },
  { value: 'meal', label: 'Meal' },
  { value: 'sleep', label: 'Sleep' },
  { value: 'task', label: 'Task' },
];

export const MEAL_SLOTS: readonly { value: MealSlot; label: string; name: string }[] = [
  { value: 'breakfast', label: 'B', name: 'Breakfast' },
  { value: 'lunch', label: 'L', name: 'Lunch' },
  { value: 'snack', label: 'S', name: 'Snack' },
  { value: 'dinner', label: 'D', name: 'Dinner' },
];

const GROUP_OF: Record<string, KindGroup> = {
  wake: 'habit',
  custom: 'habit',
  water: 'water',
  workout: 'workout',
  meal: 'meal',
  task: 'task',
  sleep: 'sleep',
  phone_off: 'sleep',
};

/** wake/custom → Habit, phone_off → Sleep (A18). */
export function kindGroup(kind: string): KindGroup {
  return GROUP_OF[kind] ?? 'habit';
}

export function kindLabel(kind: string): string {
  const g = kindGroup(kind);
  return KIND_GROUPS.find((k) => k.value === g)?.label ?? 'Habit';
}

/**
 * The DB kind for a picked design kind. Keeps the current kind when it already
 * belongs to that group, so "wake" and "phone_off" (used by F03/F15) survive.
 */
export function kindForGroup(group: KindGroup, current?: BlockKind | null): BlockKind {
  if (current && kindGroup(current) === group) return current;
  const map: Record<KindGroup, BlockKind> = {
    habit: 'custom',
    water: 'water',
    workout: 'workout',
    meal: 'meal',
    sleep: 'sleep',
    task: 'task',
  };
  return map[group];
}

/** Water, workout and meal blocks complete from their logs (PRD §4.2). */
export function autoCompletes(kind: BlockKind): boolean {
  return kind === 'water' || kind === 'workout' || kind === 'meal';
}

/** Default slot for a new meal block from its time. */
export function slotForTime(hhmm: string): MealSlot {
  const h = Number(hhmm.slice(0, 2));
  if (h < 10) return 'breakfast';
  if (h < 15) return 'lunch';
  if (h < 18) return 'snack';
  return 'dinner';
}

export type BlockLike = {
  id: string;
  client_id: string;
  template_id: string;
  title: string;
  kind: BlockKind;
  start_time: string;
  duration_min: number;
  ref_slot: string | null;
  auto_complete: boolean;
  is_optional: boolean;
  notify: boolean;
  sort: number;
  deleted_at?: string | null;
};

export const hhmm = (t: string) => t.slice(0, 5);

const minutesOf = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

/** Minutes on the logical day (times before 03:00 sort after late evening). */
export function dayMinutes(t: string): number {
  const m = minutesOf(t);
  return m < 180 ? m + 1440 : m;
}

/** A template's live blocks in timeline order (start time, then `sort`). */
export function blocksOf<T extends BlockLike>(blocks: readonly T[], templateId: string): T[] {
  return blocks
    .filter((b) => b.template_id === templateId && !b.deleted_at)
    .sort((a, b) => dayMinutes(a.start_time) - dayMinutes(b.start_time) || a.sort - b.sort);
}

/** Blocks that count in the day score (A19: optional blocks never count). */
export function countedBlocks<T extends { is_optional: boolean }>(blocks: readonly T[]): T[] {
  return blocks.filter((b) => !b.is_optional);
}

/** "Meal · 30 min", "Water · auto", "Habit · 30 min · optional", "Sleep · —". */
export function blockMeta(
  b: Pick<BlockLike, 'kind' | 'duration_min' | 'auto_complete' | 'is_optional'>,
) {
  const parts = [kindLabel(b.kind)];
  if (b.kind === 'water') parts.push(b.auto_complete ? 'auto' : 'check');
  else parts.push(b.duration_min > 0 ? `${b.duration_min} min` : '—');
  if (b.is_optional) parts.push('optional');
  return parts.join(' · ');
}

/** "12 blocks · 5:00 am – 10:00 pm" (first to last start). */
export function blocksSummary(blocks: readonly Pick<BlockLike, 'start_time'>[]): string {
  if (blocks.length === 0) return 'No blocks';
  const count = `${blocks.length} block${blocks.length === 1 ? '' : 's'}`;
  const first = blocks[0] as { start_time: string };
  const last = blocks[blocks.length - 1] as { start_time: string };
  return `${count} · ${formatClock(hhmm(first.start_time))} – ${formatClock(hhmm(last.start_time))}`;
}

export type BlockDraft = {
  title: string;
  kind: BlockKind;
  start_time: string; // HH:mm
  duration_min: number;
  ref_slot: MealSlot | null;
  notify: boolean;
  is_optional: boolean;
};

export function draftFromBlock(b: BlockLike): BlockDraft {
  return {
    title: b.title,
    kind: b.kind,
    start_time: hhmm(b.start_time),
    duration_min: b.duration_min,
    ref_slot: (b.ref_slot as MealSlot | null) ?? null,
    notify: b.notify,
    is_optional: b.is_optional,
  };
}

/** A new block starts where the last one ends (or 12:00 on an empty template). */
export function newBlockDraft(
  existing: readonly Pick<BlockLike, 'start_time' | 'duration_min'>[],
): BlockDraft {
  const last = existing[existing.length - 1];
  let start = '12:00';
  if (last) {
    const end = Math.min(minutesOf(last.start_time) + last.duration_min, 23 * 60 + 55);
    const rounded = Math.ceil(end / 5) * 5;
    start = `${String(Math.floor(rounded / 60)).padStart(2, '0')}:${String(rounded % 60).padStart(2, '0')}`;
  }
  return {
    title: '',
    kind: 'custom',
    start_time: start,
    duration_min: 15,
    ref_slot: null,
    notify: true,
    is_optional: false,
  };
}

/** Switching kind: meal blocks need a slot (DB check); other kinds have none. */
export function withKind(draft: BlockDraft, group: KindGroup): BlockDraft {
  const kind = kindForGroup(group, draft.kind);
  return {
    ...draft,
    kind,
    ref_slot: kind === 'meal' ? (draft.ref_slot ?? slotForTime(draft.start_time)) : null,
  };
}

export function validateBlock(d: BlockDraft): string | null {
  const title = d.title.trim();
  if (title.length === 0) return 'Give the block a title.';
  if (title.length > 80) return 'Keep the title under 80 characters.';
  if (d.duration_min < 0 || d.duration_min > 600) return 'Duration is 0–600 min.';
  if (d.kind === 'meal' && !d.ref_slot) return 'Pick a meal slot.';
  return null;
}
