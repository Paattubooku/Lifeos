import { act, fireEvent, screen, within } from '@testing-library/react-native';

import { renderWithStore } from '@/test/profileFixtures';
import { todayStore } from '@/test/todayFixtures';

import { FoodScreen } from '../components/FoodScreen';

const mockRouter = { push: jest.fn(), back: jest.fn(), replace: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));

beforeEach(() => jest.clearAllMocks());

type Store = Awaited<ReturnType<typeof todayStore>>['store'];
const queued = (store: Store, table: string) =>
  store
    .getState()
    .sync.queue.filter((m) => m.table === table)
    .map((m) => ({ op: m.op, client_id: m.client_id, row: m.row }));
const press = async (name: string | RegExp) => {
  await act(async () => {
    await fireEvent.press(screen.getByRole('button', { name }));
  });
};
const chip = () => screen.getByTestId('coffee-chip');

describe('Coffee (F09 AC2)', () => {
  it('tap +1: under → at → over; the third is logged with a warning; hold −1 with Undo', async () => {
    const { store, at, today } = await todayStore();
    await renderWithStore(store, <FoodScreen now={at('16:52')} />);
    expect(chip()).toHaveProp('accessibilityLabel', 'Coffee 0 of 2');

    await act(async () => {
      await fireEvent.press(chip());
    });
    expect(screen.getByText('Coffee 1 of 2 · 20 kcal')).toBeOnTheScreen();
    expect(within(screen.getByTestId('food-totals')).getByText(/^20/)).toBeOnTheScreen();
    await act(async () => {
      await fireEvent.press(chip());
    });
    expect(chip()).toHaveProp('accessibilityLabel', 'Coffee 2 of 2, at the limit');
    expect(screen.getByText('Coffee 2 of 2. That was the last one.')).toBeOnTheScreen();
    await act(async () => {
      await fireEvent.press(chip());
    });
    expect(chip()).toHaveProp('accessibilityLabel', 'Coffee 3 of 2, over the limit');
    expect(screen.getByText('Coffee 3 of 2. Over limit — still logged.')).toBeOnTheScreen();
    expect(
      within(screen.getByTestId('coffee-card')).getByText('3 of 2. Over by 1.'),
    ).toBeOnTheScreen();
    expect(queued(store, 'coffee_log')).toHaveLength(3);
    expect(queued(store, 'coffee_log').every((c) => c.row.date === today)).toBe(true);

    await act(async () => {
      await fireEvent(chip(), 'longPress');
    });
    expect(chip()).toHaveProp('accessibilityLabel', 'Coffee 2 of 2, at the limit');
    await press(/^Undo: One coffee removed/);
    expect(chip()).toHaveProp('accessibilityLabel', 'Coffee 3 of 2, over the limit');
  });

  it('Undo on the coffee toast removes it; hold with no coffee does nothing', async () => {
    const { store, at } = await todayStore();
    await renderWithStore(store, <FoodScreen now={at('09:10')} />);
    await act(async () => {
      await fireEvent(chip(), 'longPress');
    });
    expect(queued(store, 'coffee_log')).toEqual([]);
    await act(async () => {
      await fireEvent.press(chip());
    });
    await press(/^Undo: Coffee 1 of 2/);
    expect(queued(store, 'coffee_log')).toEqual([]);
    expect(chip()).toHaveProp('accessibilityLabel', 'Coffee 0 of 2');
  });
});

describe('Off-plan (F09 AC1)', () => {
  it('logs to the meal on now, shows in totals and under the meal marked off-plan, removable with Undo', async () => {
    const { store, at } = await todayStore();
    await renderWithStore(store, <FoodScreen now={at('16:40')} />);
    await press('Log off-plan food');
    const sheet = screen.getByTestId('offplan-sheet');
    expect(
      within(sheet).getByRole('button', { name: 'Add 250 kilocalories to Snack' }),
    ).toBeDisabled();
    await fireEvent.changeText(within(sheet).getByLabelText('What did you eat?'), 'Masala vada ×2');
    await fireEvent.changeText(within(sheet).getByLabelText('Protein (optional, g)'), '8');
    expect(
      within(sheet).getByText('Off: adds on top of the 405 kcal snack plan.'),
    ).toBeOnTheScreen();
    await press('Add 250 kilocalories to Snack');

    expect(queued(store, 'food_log')).toEqual([
      {
        op: 'upsert',
        client_id: expect.any(String),
        row: expect.objectContaining({
          free_text: 'Masala vada ×2',
          kcal: 250,
          protein_g: 8,
          is_off_plan: true,
          meal_id: 'm-snack',
        }),
      },
    ]);
    const snack = screen.getByTestId('meal-snack');
    expect(within(snack).getByText('Masala vada ×2')).toBeOnTheScreen();
    expect(within(snack).getByText('OFF-PLAN')).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: /^Snack, Partly eaten, 250 kcal, 8 g protein/ }),
    ).toBeOnTheScreen();
    expect(within(screen.getByTestId('food-totals')).getByText(/^250/)).toBeOnTheScreen();

    await press('Remove Masala vada ×2');
    expect(within(screen.getByTestId('meal-snack')).queryByText('Masala vada ×2')).toBeNull();
    await press(/^Undo: Masala vada ×2 removed/);
    expect(within(screen.getByTestId('meal-snack')).getByText('Masala vada ×2')).toBeOnTheScreen();
  });

  it('replaces the planned meal; chips and stepper set the kcal; validation', async () => {
    const { store, at } = await todayStore();
    await renderWithStore(store, <FoodScreen now={at('20:05')} />);
    await press('Log off-plan food for Dinner');
    const sheet = screen.getByTestId('offplan-sheet');
    await fireEvent.changeText(within(sheet).getByLabelText('What did you eat?'), 'Biryani');
    await fireEvent.press(within(sheet).getByRole('button', { name: '500 kilocalories' }));
    await fireEvent.press(within(sheet).getByRole('button', { name: 'Increase Calories' }));
    await fireEvent.changeText(within(sheet).getByLabelText('Protein (optional, g)'), '1000');
    expect(within(sheet).getByTestId('offplan-error')).toHaveTextContent('Protein is 0–999 g.');
    await fireEvent.changeText(within(sheet).getByLabelText('Protein (optional, g)'), '');
    await fireEvent(within(sheet).getByTestId('toggle-replaces'), 'valueChange', true);
    await press('Add 510 kilocalories to Dinner');
    const rows = queued(store, 'food_log');
    expect(rows).toHaveLength(1 + 3);
    expect(rows[0]?.row).toMatchObject({ free_text: 'Biryani', kcal: 510, protein_g: 0 });
    expect(rows.slice(1).every((r) => r.row.portion === 0)).toBe(true);
    expect(screen.getByRole('button', { name: /^Dinner, Eaten, 510 kcal/ })).toBeOnTheScreen();
    expect(screen.getByText(/off-plan instead of the plan$/)).toBeOnTheScreen();
    await press(/^Undo: 510 kcal off-plan added to Dinner/);
    expect(queued(store, 'food_log')).toEqual([]);
  });

  it('"Other" entries get their own card', async () => {
    const { store, at } = await todayStore();
    await renderWithStore(store, <FoodScreen now={at('23:00')} />);
    await press('Log off-plan food');
    const sheet = screen.getByTestId('offplan-sheet');
    await fireEvent.changeText(within(sheet).getByLabelText('What did you eat?'), 'Biscuits');
    await fireEvent.press(within(sheet).getByRole('button', { name: '100 kilocalories' }));
    await press('Add 100 kilocalories to Other');
    expect(within(screen.getByTestId('other-food')).getByText('Biscuits')).toBeOnTheScreen();
    expect(screen.getByText('100 kcal off-plan added')).toBeOnTheScreen();
  });
});
