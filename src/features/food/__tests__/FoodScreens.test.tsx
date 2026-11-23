import { act, fireEvent, screen, within } from '@testing-library/react-native';

import { renderWithStore } from '@/test/profileFixtures';
import { todayStore } from '@/test/todayFixtures';

import { DishEditorScreen } from '../components/DishEditorScreen';
import { FoodScreen } from '../components/FoodScreen';
import { MealDetailScreen } from '../components/MealDetailScreen';
import { PlanEditorScreen } from '../components/PlanEditorScreen';

const mockRouter = { push: jest.fn(), back: jest.fn(), replace: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));

beforeEach(() => jest.clearAllMocks());

type Store = Awaited<ReturnType<typeof todayStore>>['store'];
const writes = (store: Store, table: string) =>
  store
    .getState()
    .sync.queue.filter((m) => m.table === table)
    .map((m) => ({ op: m.op, client_id: m.client_id, row: m.row }));
const press = async (name: string | RegExp) => {
  await act(async () => {
    await fireEvent.press(screen.getByRole('button', { name }));
  });
};
const totals = () => screen.getByTestId('food-totals');

describe('Food tab', () => {
  it('totals, pace tick, the four meals and their states at 1:10 pm', async () => {
    const { store, at } = await todayStore();
    await renderWithStore(store, <FoodScreen now={at('13:10')} />);
    expect(within(totals()).getByText('2,200 left')).toBeOnTheScreen();
    expect(
      within(totals()).getByText(
        'Tick = what the plan says you should have eaten by now (1,334 kcal · 98 g).',
      ),
    ).toBeOnTheScreen();
    expect(screen.getByText('Rest of plan lands the day at 1,585 kcal · 117 g.')).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: 'Breakfast, Not logged, 634 kcal, 40 g protein. Open' }),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: 'Lunch, Now, 700 kcal, 58 g protein. Open' }),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: 'Dinner, Upcoming, 480 kcal, 38 g protein. Open' }),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: /^Lunch, Now/ }));
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/meal/[slot]',
      params: { slot: 'lunch' },
    });
    await fireEvent.press(screen.getByRole('button', { name: 'Edit meal plan' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/meal-plan');
  });

  it('F08 AC1: all four meals eaten as planned → 2,219 kcal / 157 g; kcal-over insight', async () => {
    const { store, at } = await todayStore();
    await renderWithStore(store, <FoodScreen now={at('21:00')} />);
    for (const meal of ['Breakfast', 'Lunch', 'Snack', 'Dinner'])
      await press(`${meal} eaten as planned`);
    expect(writes(store, 'food_log')).toHaveLength(14);
    expect(within(totals()).getByText('19 over')).toBeOnTheScreen();
    expect(within(totals()).getByText(/^157 g/)).toBeOnTheScreen();
    expect(screen.getByTestId('insight-kcal-over')).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: 'Dinner, Eaten, 480 kcal, 38 g protein. Open' }),
    ).toBeOnTheScreen();
    expect(screen.getAllByText(/all 3 dishes$/)).toHaveLength(2); // breakfast and dinner
  });

  it('Undo of "Eaten as planned" removes the logs; ticking one dish → partly eaten', async () => {
    const { store, at } = await todayStore();
    await renderWithStore(store, <FoodScreen now={at('09:00')} />);
    await press('Breakfast eaten as planned');
    await press(/^Undo: Breakfast eaten as planned/);
    expect(writes(store, 'food_log')).toEqual([]);
    await act(async () => {
      await fireEvent.press(screen.getByLabelText('Tick Sambar'));
    });
    expect(
      screen.getByRole('button', { name: 'Breakfast, Partly eaten, 150 kcal, 7 g protein. Open' }),
    ).toBeOnTheScreen();
    await act(async () => {
      await fireEvent.press(screen.getByLabelText('Untick Sambar'));
    });
    expect(writes(store, 'food_log')).toEqual([]);
  });

  it('F08 AC2: swap Idli → Dosa (today only) adds 90 kcal to the plan; make default writes meal_item', async () => {
    const { store, at } = await todayStore();
    await renderWithStore(store, <FoodScreen now={at('06:00')} />);
    await press('Swap Idli');
    const sheet = screen.getByTestId('swap-sheet');
    expect(
      within(sheet).getByText('Breakfast · now Idli 4 pcs · 240 kcal · 8 g'),
    ).toBeOnTheScreen();
    expect(within(sheet).getByText('Most protein')).toBeOnTheScreen();
    expect(
      within(sheet).getByText(
        'Breakfast becomes 724 kcal · 40 g. Day plan: 2,309 kcal (109 over).',
      ),
    ).toBeOnTheScreen();
    await press('Swap to Dosa');
    expect(
      screen.getByRole('button', { name: 'Breakfast, Upcoming, 724 kcal, 40 g protein. Open' }),
    ).toBeOnTheScreen();
    expect(writes(store, 'food_log')).toEqual([]); // not eaten: only today's plan changes

    await press('Swap Dosa');
    await fireEvent.press(
      within(screen.getByTestId('swap-sheet')).getByRole('radio', { name: /^Pesarattu/ }),
    );
    await fireEvent.press(
      within(screen.getByTestId('swap-sheet')).getByRole('radio', { name: 'Make default' }),
    );
    await press('Swap to Pesarattu');
    expect(writes(store, 'meal_item')).toEqual([
      { op: 'upsert', client_id: 'i-breakfast-idli-c', row: { is_default: false } },
      { op: 'upsert', client_id: 'i-breakfast-pesarattu-c', row: { is_default: true } },
    ]);
    expect(screen.getByText('Pesarattu is the new default')).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: /^Breakfast, Upcoming, 694 kcal/ }),
    ).toBeOnTheScreen();
  });

  it('swapping an eaten dish rewrites its log', async () => {
    const { store, at } = await todayStore();
    await renderWithStore(store, <FoodScreen now={at('09:00')} />);
    await press('Breakfast eaten as planned');
    await press('Swap Idli');
    await press('Swap to Dosa');
    const idli = writes(store, 'food_log').find((w) => w.row.swap_group === 'base');
    expect(idli?.row).toMatchObject({ dish_id: 'd-breakfast-dosa', kcal: 330 });
    await press(/^Undo: Swapped to Dosa/);
    expect(writes(store, 'food_log').find((w) => w.row.swap_group === 'base')?.row).toMatchObject({
      kcal: 240,
    });
  });

  it('protein insight after 4:30 pm', async () => {
    const { store, at } = await todayStore();
    await renderWithStore(store, <FoodScreen now={at('17:00')} />);
    await press('Breakfast eaten as planned');
    expect(screen.getByTestId('insight-protein-low')).toBeOnTheScreen();
  });
});

describe('Meal detail', () => {
  it('tiles, alternatives with deltas, portion picker', async () => {
    const { store, at } = await todayStore();
    await renderWithStore(store, <MealDetailScreen slot="breakfast" now={at('07:30')} />);
    expect(screen.getByRole('header', { name: 'Breakfast' })).toBeOnTheScreen();
    expect(screen.getByText('0 / 3')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Swap to Dosa, +90 kcal' })).toBeOnTheScreen();
    await press('Breakfast eaten as planned');
    expect(screen.getByText('3 / 3')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Breakfast eaten as planned' })).toBeNull();
    const portions = within(screen.getByTestId('group-protein')).getByLabelText(/portion$/);
    await act(async () => {
      await fireEvent.press(within(portions).getByRole('radio', { name: '½' }));
    });
    const eggs = writes(store, 'food_log').find((w) => w.row.swap_group === 'protein');
    expect(eggs?.row).toMatchObject({ portion: 0.5, kcal: 122, protein_g: 12.5 });
    await press('Swap to Pesarattu, +60 kcal');
    expect(screen.getByTestId('swap-sheet')).toBeOnTheScreen();
  });

  it('unknown slot', async () => {
    const { store, at } = await todayStore();
    await renderWithStore(store, <MealDetailScreen slot="brunch" now={at('07:30')} />);
    expect(screen.getByText('No such meal in the plan')).toBeOnTheScreen();
  });
});

describe('Plan editor', () => {
  it('plan totals, items with swap marks, remove with Undo, add dish', async () => {
    const { store } = await todayStore();
    await renderWithStore(store, <PlanEditorScreen />);
    expect(screen.getByText('2,219')).toBeOnTheScreen();
    expect(screen.getByText('157 g')).toBeOnTheScreen();
    expect(screen.getByText(/^19 kcal over target, 7 g protein over/)).toBeOnTheScreen();
    await press('Remove Idli from Breakfast');
    expect(writes(store, 'meal_item')).toEqual([
      { op: 'soft_delete', client_id: 'i-breakfast-idli-c', row: expect.any(Object) },
      { op: 'upsert', client_id: 'i-breakfast-dosa-c', row: { is_default: true } },
    ]);
    await press(/^Undo: Idli removed/);
    expect(
      writes(store, 'meal_item').map((w) => [w.client_id, w.row.is_default, w.row.deleted_at]),
    ).toEqual([
      ['i-breakfast-idli-c', true, null],
      ['i-breakfast-dosa-c', false, undefined],
    ]);
    await fireEvent.press(screen.getByRole('button', { name: 'Add a dish to Snack' }));
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/dish/[id]',
      params: { id: 'new', meal: 'm-snack' },
    });
    await fireEvent.press(screen.getByRole('button', { name: /^Chicken curry, protein, default/ }));
    expect(mockRouter.push).toHaveBeenLastCalledWith({
      pathname: '/dish/[id]',
      params: { id: 'd-lunch-chicken-curry', meal: 'm-lunch', item: 'i-lunch-chicken-curry' },
    });
  });
});

describe('Dish editor', () => {
  it('F08 AC3 path: editing kcal writes only the dish (logs keep their stored kcal)', async () => {
    const { store } = await todayStore();
    await renderWithStore(
      store,
      <DishEditorScreen
        id="d-lunch-chicken-curry"
        mealId="m-lunch"
        itemId="i-lunch-chicken-curry"
      />,
    );
    expect(screen.getByTestId('macro-check')).toHaveTextContent(/Macros add to 290 kcal/);
    await fireEvent.changeText(screen.getByLabelText('Calories (kcal)'), '330');
    await press('Save dish');
    expect(writes(store, 'dish')).toEqual([
      { op: 'upsert', client_id: 'd-lunch-chicken-curry-c', row: { kcal: 330 } },
    ]);
    expect(writes(store, 'food_log')).toEqual([]);
    expect(mockRouter.back).toHaveBeenCalled();
  });

  it('new dish in a new swap group with a shopping item; validation', async () => {
    const { store } = await todayStore();
    await renderWithStore(store, <DishEditorScreen id="new" mealId="m-snack" />);
    expect(screen.getByRole('button', { name: 'Add dish' })).toBeDisabled();
    await fireEvent.changeText(screen.getByLabelText('Name'), 'Dates');
    expect(screen.getByTestId('dish-error')).toHaveTextContent(/Calories/);
    await fireEvent.changeText(screen.getByLabelText('Calories (kcal)'), '70');
    await fireEvent.changeText(screen.getByLabelText('Carbs (g)'), '18');
    await fireEvent.changeText(screen.getByLabelText('Protein (g)'), '0.5');
    await fireEvent.changeText(screen.getByLabelText('Fat (g)'), '0');
    await fireEvent.changeText(screen.getByLabelText('New group'), 'sweet');
    await fireEvent.changeText(screen.getByLabelText('Item'), 'Dates');
    await fireEvent.changeText(screen.getByLabelText('Qty'), '3');
    await fireEvent.press(screen.getByRole('button', { name: 'Add shopping item' }));
    expect(screen.getByRole('button', { name: 'Remove Dates' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('radio', { name: 'Weekly' }));
    await press('Add dish');
    const [dish] = writes(store, 'dish');
    expect(dish?.row).toMatchObject({
      name: 'Dates',
      kcal: 70,
      protein_g: 0.5,
      carbs_g: 18,
      buy: 'weekly',
      shopping_items: [{ item: 'Dates', qty: '3', unit: '' }],
    });
    expect(writes(store, 'meal_item')[0]?.row).toMatchObject({
      meal_id: 'm-snack',
      swap_group: 'sweet',
      is_default: true,
      dish_id: dish?.row.id,
    });
  });

  it('moving a dish to another group; delete with Undo', async () => {
    const { store } = await todayStore();
    await renderWithStore(
      store,
      <DishEditorScreen id="d-breakfast-dosa" itemId="i-breakfast-dosa" />,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Swap group side' }));
    await press('Save dish');
    expect(writes(store, 'meal_item').at(-1)?.row).toEqual({
      swap_group: 'side',
      is_default: false,
    });
    await renderWithStore(store, <DishEditorScreen id="d-dinner-dosa" />);
    await press('Delete Dosa');
    expect(writes(store, 'dish').at(-1)).toMatchObject({
      op: 'soft_delete',
      client_id: 'd-dinner-dosa-c',
    });
    await press(/^Undo: Dosa deleted/);
    expect(writes(store, 'dish').at(-1)).toMatchObject({ op: 'upsert', row: { deleted_at: null } });
  });

  it('unknown dish', async () => {
    const { store } = await todayStore();
    await renderWithStore(store, <DishEditorScreen id="nope" />);
    expect(screen.getByText('Dish not found')).toBeOnTheScreen();
  });
});
