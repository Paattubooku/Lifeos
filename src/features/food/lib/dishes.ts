import type { Change } from '@/features/routine/lib/changes';

import { type DishRow, type ItemRow, num } from './plan';

export type DishDraft = {
  name: string;
  serving_text: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

export function draftFromDish(d: DishRow): DishDraft {
  return {
    name: d.name,
    serving_text: d.serving_text,
    kcal: d.kcal,
    protein_g: num(d.protein_g),
    carbs_g: num(d.carbs_g),
    fat_g: num(d.fat_g),
  };
}

export const EMPTY_DISH: DishDraft = {
  name: '',
  serving_text: '',
  kcal: 0,
  protein_g: 0,
  carbs_g: 0,
  fat_g: 0,
};

export function validateDish(d: DishDraft): string | null {
  const name = d.name.trim();
  if (name.length === 0) return 'Give the dish a name.';
  if (name.length > 80) return 'Keep the name under 80 characters.';
  if (!Number.isInteger(d.kcal) || d.kcal < 0 || d.kcal > 5000)
    return 'Calories are a whole number, 0–5,000.';
  for (const [label, v] of [
    ['Protein', d.protein_g],
    ['Carbs', d.carbs_g],
    ['Fat', d.fat_g],
  ] as const) {
    if (!Number.isFinite(v) || v < 0 || v > 999) return `${label} is 0–999 g.`;
  }
  return null;
}

/** "Macros add to 334 kcal (4/4/9). Matches 330 within 2%." — a typo catcher. */
export function macroCheck(d: Pick<DishDraft, 'kcal' | 'protein_g' | 'carbs_g' | 'fat_g'>) {
  const fromMacros = Math.round(d.protein_g * 4 + d.carbs_g * 4 + d.fat_g * 9);
  const diff = d.kcal > 0 ? Math.abs(fromMacros - d.kcal) / d.kcal : fromMacros > 0 ? 1 : 0;
  const pct = Math.round(diff * 100);
  const ok = diff <= 0.1;
  return {
    fromMacros,
    ok,
    text: ok
      ? `Macros add to ${fromMacros} kcal (4/4/9). Matches ${d.kcal} within ${Math.max(pct, 1)}%.`
      : `Macros add to ${fromMacros} kcal (4/4/9), ${pct}% off ${d.kcal}. Check the numbers.`,
  };
}

function dishRow(d: DishDraft) {
  return {
    name: d.name.trim(),
    serving_text: d.serving_text.trim(),
    kcal: d.kcal,
    protein_g: d.protein_g,
    carbs_g: d.carbs_g,
    fat_g: d.fat_g,
  };
}

const maxSort = (rows: readonly { sort: number }[]) =>
  rows.reduce((m, r) => Math.max(m, r.sort), -1);

/** Add a dish to a meal in a swap group; it becomes the group's default if the group is new. */
export function planAddItem(
  mealId: string,
  dishId: string,
  group: string,
  items: readonly ItemRow[],
  newId: string,
): Change[] {
  const live = items.filter((i) => !i.deleted_at && i.meal_id === mealId);
  const hasDefault = live.some((i) => i.swap_group === group && i.is_default);
  return [
    {
      op: 'upsert',
      table: 'meal_item',
      row: {
        id: newId,
        meal_id: mealId,
        dish_id: dishId,
        swap_group: group.trim(),
        is_default: !hasDefault,
        sort: maxSort(live) + 1,
      },
    },
  ];
}

/**
 * Save from the dish editor. New dish: insert (client-made id) and, from a
 * meal, add it there. Edit: changed fields only. Past food_log rows keep their
 * stored kcal/protein, so edits apply from today on (F08 AC3).
 */
export function planDishSave(
  original: DishRow | null,
  draft: DishDraft,
  ctx: {
    newDishId: string;
    newItemId: string;
    mealId?: string;
    group?: string;
    items: readonly ItemRow[];
  },
): Change[] {
  const row = dishRow(draft);
  if (!original) {
    const changes: Change[] = [{ op: 'upsert', table: 'dish', row: { id: ctx.newDishId, ...row } }];
    if (ctx.mealId)
      changes.push(
        ...planAddItem(
          ctx.mealId,
          ctx.newDishId,
          ctx.group?.trim() || 'main',
          ctx.items,
          ctx.newItemId,
        ),
      );
    return changes;
  }
  const before = dishRow(draftFromDish(original));
  const changed = Object.fromEntries(
    Object.entries(row).filter(
      ([k, v]) => JSON.stringify(before[k as keyof typeof before]) !== JSON.stringify(v),
    ),
  );
  return Object.keys(changed).length === 0
    ? []
    : [{ op: 'upsert', table: 'dish', clientId: original.client_id, row: changed }];
}

/** Hand "default" to another dish when the default leaves its group. */
function promoteIfNeeded(leaving: ItemRow, items: readonly ItemRow[]): Change[] {
  if (!leaving.is_default) return [];
  const heir = items
    .filter(
      (i) =>
        !i.deleted_at &&
        i.id !== leaving.id &&
        i.meal_id === leaving.meal_id &&
        i.swap_group === leaving.swap_group,
    )
    .sort((a, b) => a.sort - b.sort)[0];
  return heir
    ? [{ op: 'upsert', table: 'meal_item', clientId: heir.client_id, row: { is_default: true } }]
    : [];
}

/** Remove a dish from a meal (the dish stays in the library). */
export function planRemoveItem(item: ItemRow, items: readonly ItemRow[]): Change[] {
  return [
    { op: 'delete', table: 'meal_item', clientId: item.client_id },
    ...promoteIfNeeded(item, items),
  ];
}

/** Move a dish to another swap group of its meal. */
export function planSetGroup(item: ItemRow, group: string, items: readonly ItemRow[]): Change[] {
  const g = group.trim();
  if (!g || g === item.swap_group) return [];
  const targetHasDefault = items.some(
    (i) => !i.deleted_at && i.meal_id === item.meal_id && i.swap_group === g && i.is_default,
  );
  return [
    { op: 'upsert', table: 'meal_item', clientId: item.client_id, row: { is_default: false } },
    ...promoteIfNeeded(item, items),
    {
      op: 'upsert',
      table: 'meal_item',
      clientId: item.client_id,
      row: { swap_group: g, is_default: !targetHasDefault },
    },
  ];
}

/** Delete a dish everywhere: its meal items first (promoting defaults), then the dish. */
export function planDeleteDish(dish: DishRow, items: readonly ItemRow[]): Change[] {
  const mine = items.filter((i) => !i.deleted_at && i.dish_id === dish.id);
  let rest = [...items];
  const changes: Change[] = [];
  for (const item of mine) {
    changes.push(...planRemoveItem(item, rest));
    rest = rest.filter((i) => i.id !== item.id);
  }
  changes.push({ op: 'delete', table: 'dish', clientId: dish.client_id });
  return changes;
}

/** Swap groups of a meal in order of first appearance. */
export function groupsOf(mealId: string, items: readonly ItemRow[]): string[] {
  const out: string[] = [];
  for (const i of [...items]
    .filter((x) => !x.deleted_at && x.meal_id === mealId)
    .sort((a, b) => a.sort - b.sort))
    if (!out.includes(i.swap_group)) out.push(i.swap_group);
  return out;
}

/**
 * Undo for item edits/removals: put every item back as it was (group,
 * default, alive). Items losing "default" go first so the one-default-per-
 * group index never sees two.
 */
export function planRestoreItems(
  before: readonly ItemRow[],
  current: readonly ItemRow[],
): Change[] {
  const now = new Map(current.map((i) => [i.id, i]));
  const changed = before.filter((b) => {
    const c = now.get(b.id);
    return !c || c.deleted_at || c.is_default !== b.is_default || c.swap_group !== b.swap_group;
  });
  const extraDefaults = current.filter(
    (c) => !c.deleted_at && c.is_default && before.some((b) => b.id === c.id && !b.is_default),
  );
  const lose = extraDefaults.map((c): Change => ({
    op: 'upsert',
    table: 'meal_item',
    clientId: c.client_id,
    row: { is_default: false },
  }));
  const restore = changed
    .filter((b) => !extraDefaults.some((c) => c.id === b.id))
    .map((b): Change => ({
      op: 'upsert',
      table: 'meal_item',
      clientId: b.client_id,
      row: { swap_group: b.swap_group, is_default: b.is_default, deleted_at: null },
    }));
  return [...lose, ...restore];
}

/** Undo a dish delete: the dish, then its items as they were. */
export function planRestoreDish(
  dish: DishRow,
  itemsBefore: readonly ItemRow[],
  itemsNow: readonly ItemRow[],
): Change[] {
  return [
    { op: 'upsert', table: 'dish', clientId: dish.client_id, row: { deleted_at: null } },
    ...planRestoreItems(itemsBefore, itemsNow),
  ];
}
