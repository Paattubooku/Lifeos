import { act, fireEvent, screen, within } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';

import { TodayScreen } from '@/features/today/components/TodayScreen';
import { renderWithStore } from '@/test/profileFixtures';
import { todayStore } from '@/test/todayFixtures';

import { WaterScreen } from '../components/WaterScreen';

const mockRouter = { push: jest.fn(), back: jest.fn(), replace: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));

beforeEach(() => jest.clearAllMocks());

type Store = Awaited<ReturnType<typeof todayStore>>['store'];
const water = (store: Store) =>
  store
    .getState()
    .sync.queue.filter((m) => m.table === 'water_log')
    .map((m) => ({ op: m.op, client_id: m.client_id, ml: m.row.amount_ml }));
const press = async (name: string | RegExp) => {
  await act(async () => {
    await fireEvent.press(screen.getByRole('button', { name }));
  });
};

const MORNING: [string, number][] = [
  ['05:12', 500],
  ['06:40', 200],
  ['08:05', 200],
  ['10:30', 200],
  ['12:00', 300],
];

describe('WaterScreen', () => {
  it('ring, pace tick caption and the behind banner at 2:20 pm (1,400 of 3,000)', async () => {
    const { store, at } = await todayStore({ water: MORNING });
    await renderWithStore(store, <WaterScreen now={at('14:20')} />);
    expect(screen.getByLabelText('Water 1,400 of 3,000 ml, 47 percent')).toBeOnTheScreen();
    expect(screen.getByText('1,600 ml left by 9:00 pm')).toBeOnTheScreen();
    expect(
      screen.getByText('White tick = pace for 2:20 pm (1,750 ml). Pace runs 5:00 am → 9:00 pm.'),
    ).toBeOnTheScreen();
    expect(screen.getByTestId('ring-marker')).toBeOnTheScreen();
    expect(
      within(screen.getByTestId('behind-banner')).getByText('350 ml behind. Drink 350 ml now.'),
    ).toBeOnTheScreen();
    await press('Drink 350 ml now');
    expect(water(store)).toEqual([{ op: 'upsert', client_id: expect.any(String), ml: 350 }]);
    expect(screen.queryByTestId('behind-banner')).toBeNull();
  });

  it('quick adds and the custom amount (AC3: inline error outside 1–2,000 ml)', async () => {
    const { store, at } = await todayStore();
    await renderWithStore(store, <WaterScreen now={at('14:20')} />);
    await press('Add 750 ml');
    expect(screen.getByText('750 ml logged')).toBeOnTheScreen();

    const input = screen.getByLabelText('Custom amount in ml');
    await fireEvent.changeText(input, '2500');
    expect(screen.getByTestId('amount-error')).toHaveTextContent('At most 2,000 ml at a time.');
    expect(screen.getByRole('button', { name: 'Add 2500 ml' })).toBeDisabled();
    await fireEvent.changeText(input, '0');
    expect(screen.getByTestId('amount-error')).toHaveTextContent('At least 1 ml.');
    await fireEvent.changeText(input, '');
    expect(screen.getByTestId('amount-error')).toHaveTextContent(/whole number/);
    await fireEvent.changeText(input, '350');
    expect(screen.queryByTestId('amount-error')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Increase custom amount' }));
    await press('Add 400 ml');
    await fireEvent.changeText(input, '1990');
    await fireEvent.press(screen.getByRole('button', { name: 'Increase custom amount' }));
    expect(input).toHaveProp('value', '2000');
    await fireEvent.changeText(input, '10');
    await fireEvent.press(screen.getByRole('button', { name: 'Decrease custom amount' }));
    expect(input).toHaveProp('value', '50');
    expect(water(store).map((w) => w.ml)).toEqual([750, 400]);
  });

  it('AC4: crossing the target fires the success haptic + toast once a day', async () => {
    const { store, at, today } = await todayStore({ water: [['18:00', 2800]] });
    await renderWithStore(store, <WaterScreen now={at('20:00')} />);
    await press('Add 200 ml');
    expect(Haptics.notificationAsync).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Water goal hit · 3,000 ml')).toBeOnTheScreen();
    expect(store.getState().app.waterGoalCelebrated).toBe(today);

    // Undo drops below, logging again crosses again — no second celebration today.
    await press(/^Undo: Water goal hit/);
    await press('Add 200 ml');
    expect(Haptics.notificationAsync).toHaveBeenCalledTimes(1);
    expect(screen.getByText('200 ml logged')).toBeOnTheScreen();
  });

  it('today’s log: entries, Undo last, swipe delete with Undo', async () => {
    const { store, at } = await todayStore({ water: MORNING });
    await renderWithStore(store, <WaterScreen now={at('14:20')} />);
    const log = screen.getByTestId('water-log');
    expect(within(log).getByText('5 entries · swipe left to delete')).toBeOnTheScreen();
    expect(within(log).getByText('12:00 pm')).toBeOnTheScreen();
    await press('Undo last entry, 300 ml');
    expect(water(store)).toEqual([{ op: 'soft_delete', client_id: 'w4-c', ml: undefined }]);
    expect(
      within(screen.getByTestId('water-log')).getByText('4 entries · swipe left to delete'),
    ).toBeOnTheScreen();
    await press(/^Undo: 300 ml deleted/);
    expect(water(store)).toEqual([{ op: 'upsert', client_id: 'w4-c', ml: 300 }]);
    expect(
      within(screen.getByTestId('water-log')).getByText('5 entries · swipe left to delete'),
    ).toBeOnTheScreen();
  });

  it('streak, best, 7-day average and bars', async () => {
    const history = Array.from({ length: 9 }, (_, i) => ({ daysAgo: i + 1, ml: 3000 }));
    const { store, at } = await todayStore({
      water: [['09:00', 1000]],
      waterHistory: [...history, { daysAgo: 10, ml: 2000 }],
    });
    await renderWithStore(store, <WaterScreen now={at('14:20')} />);
    expect(screen.getAllByText('9 days')).toHaveLength(2); // current and best
    expect(screen.getByText('3,000')).toBeOnTheScreen(); // 7-day average
    expect(screen.getByText('Goal hit 7 of 7')).toBeOnTheScreen();
    expect(screen.getAllByLabelText(/: 3,000 ml, goal hit$/)).toHaveLength(7);
  });

  it('empty day before wake', async () => {
    const { store, at } = await todayStore();
    await renderWithStore(store, <WaterScreen now={at('04:00')} />);
    expect(screen.getByText('Nothing yet')).toBeOnTheScreen();
    expect(screen.queryByTestId('ring-marker')).toBeNull();
    expect(screen.getAllByText('0 days')).toHaveLength(2);
  });
});

describe('Water on Today', () => {
  it('card with the gap and one-tap catch-up; opens the water screen', async () => {
    const { store, at } = await todayStore({ water: [['09:00', 1400]] });
    await renderWithStore(store, <TodayScreen now={at('13:15')} />);
    const card = screen.getByTestId('water-card');
    expect(within(card).getByText('147 ml behind. Drink 150 ml now.')).toBeOnTheScreen();
    await press('Drink 150 ml now');
    expect(water(store).map((w) => w.ml)).toEqual([150]);
    await fireEvent.press(screen.getByRole('button', { name: /^Water 1550 of 3000 ml\./ }));
    expect(mockRouter.push).toHaveBeenCalledWith('/water');
  });

  it('FAB: tap = +200, hold = add sheet', async () => {
    const { store, at } = await todayStore();
    await renderWithStore(store, <TodayScreen now={at('14:20')} />);
    await press('Add 200 ml of water. Hold for more amounts');
    expect(water(store).map((w) => w.ml)).toEqual([200]);
    await act(async () => {
      await fireEvent(
        screen.getByRole('button', { name: 'Add 200 ml of water. Hold for more amounts' }),
        'longPress',
      );
    });
    const sheet = screen.getByTestId('water-sheet');
    expect(within(sheet).getByText('1,550 ml behind pace')).toBeOnTheScreen();
    await act(async () => {
      await fireEvent.press(within(sheet).getByRole('button', { name: 'Add 750 ml, large' }));
    });
    expect(water(store).map((w) => w.ml)).toEqual([200, 750]);
    expect(screen.queryByTestId('water-sheet')).toBeNull();
  });
});
