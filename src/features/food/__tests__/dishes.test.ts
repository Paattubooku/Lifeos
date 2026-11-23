import { seedMealPlan } from '@/test/foodFixtures';

import {
  draftFromDish,
  EMPTY_DISH,
  groupsOf,
  macroCheck,
  planAddItem,
  planDeleteDish,
  planDishSave,
  planRemoveItem,
  planRestoreDish,
  planRestoreItems,
  planSetGroup,
  shoppingItems,
  validateDish,
} from '../lib/dishes';

const plan = seedMealPlan();
const dish = (id: string) => plan.dishes.find((d) => d.id === id)!;
const item = (id: string) => plan.items.find((i) => i.id === id)!;

describe('dish drafts', () => {
  it('draftFromDish, shoppingItems', () => {
    expect(draftFromDish(dish('d-lunch-chicken-curry'))).toMatchObject({
      name: 'Chicken curry',
      kcal: 300,
      protein_g: 46,
      buy: 'daily',
      shopping_items: [],
    });
    expect(draftFromDish({ ...dish('d-lunch-curd'), buy: 'odd' }).buy).toBe('daily');
    expect(shoppingItems([{ item: 'Onion', qty: 1 }, null, 'x'])).toEqual([
      { item: 'Onion', qty: '1', unit: '' },
    ]);
    expect(shoppingItems('nope')).toEqual([]);
  });

  it('validateDish', () => {
    const d = draftFromDish(dish('d-lunch-curd'));
    expect(validateDish(d)).toBeNull();
    expect(validateDish({ ...d, name: ' ' })).toMatch(/name/);
    expect(validateDish({ ...d, name: 'x'.repeat(81) })).toMatch(/80/);
    expect(validateDish({ ...d, kcal: 12.5 })).toMatch(/whole/);
    expect(validateDish({ ...d, kcal: 5001 })).toMatch(/5,000/);
    expect(validateDish({ ...d, fat_g: -1 })).toBe('Fat is 0–999 g.');
    expect(validateDish({ ...d, protein_g: Number.NaN })).toBe('Protein is 0–999 g.');
  });

  it('macroCheck: 4/4/9 within 10 %', () => {
    expect(macroCheck({ kcal: 330, protein_g: 44, carbs_g: 8, fat_g: 14 })).toEqual({
      fromMacros: 334,
      ok: true,
      text: 'Macros add to 334 kcal (4/4/9). Matches 330 within 1%.',
    });
    expect(macroCheck({ kcal: 100, protein_g: 0, carbs_g: 50, fat_g: 0 }).text).toBe(
      'Macros add to 200 kcal (4/4/9), 100% off 100. Check the numbers.',
    );
    expect(macroCheck({ kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }).ok).toBe(true);
    expect(macroCheck({ kcal: 0, protein_g: 1, carbs_g: 0, fat_g: 0 }).ok).toBe(false);
  });
});

describe('saving dishes', () => {
  it('new dish from a meal: insert the dish, then add it to the meal', () => {
    const draft = {
      ...EMPTY_DISH,
      name: ' Upma ',
      kcal: 250,
      shopping_items: [
        { item: 'Rava', qty: '50', unit: 'g' },
        { item: ' ', qty: '', unit: '' },
      ],
    };
    expect(
      planDishSave(null, draft, {
        newDishId: 'D',
        newItemId: 'I',
        mealId: 'm-breakfast',
        group: 'base',
        items: plan.items,
      }),
    ).toEqual([
      {
        op: 'upsert',
        table: 'dish',
        row: {
          id: 'D',
          name: 'Upma',
          serving_text: '',
          kcal: 250,
          protein_g: 0,
          carbs_g: 0,
          fat_g: 0,
          buy: 'daily',
          shopping_items: [{ item: 'Rava', qty: '50', unit: 'g' }],
        },
      },
      {
        op: 'upsert',
        table: 'meal_item',
        row: {
          id: 'I',
          meal_id: 'm-breakfast',
          dish_id: 'D',
          swap_group: 'base',
          is_default: false,
          sort: 7,
        },
      },
    ]);
    expect(planDishSave(null, draft, { newDishId: 'D', newItemId: 'I', items: [] })).toHaveLength(
      1,
    );
    expect(
      planDishSave(null, draft, { newDishId: 'D', newItemId: 'I', mealId: 'm-x', items: [] })[1],
    ).toMatchObject({
      row: { swap_group: 'main', is_default: true, sort: 0 },
    });
  });

  it('edit sends changed fields only', () => {
    const d = dish('d-breakfast-idli');
    expect(planDishSave(d, draftFromDish(d), { newDishId: '', newItemId: '', items: [] })).toEqual(
      [],
    );
    expect(
      planDishSave(
        d,
        { ...draftFromDish(d), kcal: 260, buy: 'weekly' },
        { newDishId: '', newItemId: '', items: [] },
      ),
    ).toEqual([
      {
        op: 'upsert',
        table: 'dish',
        clientId: 'd-breakfast-idli-c',
        row: { kcal: 260, buy: 'weekly' },
      },
    ]);
  });
});

describe('meal items and swap groups', () => {
  it('add to a new group becomes its default; existing group does not', () => {
    expect(planAddItem('m-snack', 'x', 'sweet', plan.items, 'n')[0]).toMatchObject({
      row: { is_default: true, sort: 21 },
    });
    expect(planAddItem('m-snack', 'x', 'fruit', plan.items, 'n')[0]).toMatchObject({
      row: { is_default: false },
    });
  });

  it('removing the default promotes the next dish of the group', () => {
    expect(planRemoveItem(item('i-breakfast-idli'), plan.items)).toEqual([
      { op: 'delete', table: 'meal_item', clientId: 'i-breakfast-idli-c' },
      {
        op: 'upsert',
        table: 'meal_item',
        clientId: 'i-breakfast-dosa-c',
        row: { is_default: true },
      },
    ]);
    expect(planRemoveItem(item('i-breakfast-dosa'), plan.items)).toHaveLength(1);
    expect(planRemoveItem(item('i-breakfast-sambar'), plan.items)).toHaveLength(1); // last of its group
  });

  it('moving a dish to another group', () => {
    expect(planSetGroup(item('i-breakfast-dosa'), 'base', plan.items)).toEqual([]);
    expect(planSetGroup(item('i-breakfast-dosa'), ' ', plan.items)).toEqual([]);
    expect(planSetGroup(item('i-breakfast-sambar'), 'protein', plan.items).at(-1)).toMatchObject({
      row: { swap_group: 'protein', is_default: false },
    });
    expect(planSetGroup(item('i-breakfast-idli'), 'bread', plan.items)).toEqual([
      {
        op: 'upsert',
        table: 'meal_item',
        clientId: 'i-breakfast-idli-c',
        row: { is_default: false },
      },
      {
        op: 'upsert',
        table: 'meal_item',
        clientId: 'i-breakfast-dosa-c',
        row: { is_default: true },
      },
      {
        op: 'upsert',
        table: 'meal_item',
        clientId: 'i-breakfast-idli-c',
        row: { swap_group: 'bread', is_default: true },
      },
    ]);
  });

  it('deleting a dish removes its items then the dish', () => {
    const changes = planDeleteDish(dish('d-breakfast-idli'), plan.items);
    expect(changes.map((c) => c.table)).toEqual(['meal_item', 'meal_item', 'dish']);
    expect(planDeleteDish(dish('d-breakfast-dosa'), plan.items)).toHaveLength(2);
  });

  it('groupsOf keeps first-seen order', () => {
    expect(groupsOf('m-lunch', plan.items)).toEqual(['base', 'protein', 'veg', 'dairy']);
  });
});

describe('undo', () => {
  const apply = (items: typeof plan.items, changes: ReturnType<typeof planRemoveItem>) => {
    let out = [...items];
    for (const c of changes) {
      out = out.map((i) =>
        i.client_id !== c.clientId
          ? i
          : c.op === 'delete'
            ? { ...i, deleted_at: 'x' }
            : { ...i, ...c.row },
      );
    }
    return out;
  };

  it('restoring a removed default: demote the heir first, then revive the item', () => {
    const after = apply(plan.items, planRemoveItem(item('i-breakfast-idli'), plan.items));
    expect(planRestoreItems(plan.items, after)).toEqual([
      {
        op: 'upsert',
        table: 'meal_item',
        clientId: 'i-breakfast-dosa-c',
        row: { is_default: false },
      },
      {
        op: 'upsert',
        table: 'meal_item',
        clientId: 'i-breakfast-idli-c',
        row: { swap_group: 'base', is_default: true, deleted_at: null },
      },
    ]);
    expect(planRestoreItems(plan.items, plan.items)).toEqual([]);
  });

  it('restoring a deleted dish revives it and its items', () => {
    const d = dish('d-breakfast-dosa');
    const after = apply(
      plan.items,
      planDeleteDish(d, plan.items).filter((c) => c.table === 'meal_item'),
    );
    expect(planRestoreDish(d, plan.items, after)).toEqual([
      { op: 'upsert', table: 'dish', clientId: 'd-breakfast-dosa-c', row: { deleted_at: null } },
      {
        op: 'upsert',
        table: 'meal_item',
        clientId: 'i-breakfast-dosa-c',
        row: { swap_group: 'base', is_default: false, deleted_at: null },
      },
    ]);
  });
});
