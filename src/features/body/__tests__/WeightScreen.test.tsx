import { act, fireEvent, screen, within } from '@testing-library/react-native';

import { renderWithStore } from '@/test/profileFixtures';
import { todayStore } from '@/test/todayFixtures';

import { WeightScreen } from '../components/WeightScreen';

const mockRouter = { push: jest.fn(), back: jest.fn(), replace: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));

beforeEach(() => jest.clearAllMocks());

type Store = Awaited<ReturnType<typeof todayStore>>['store'];
const weights = (store: Store) =>
  store
    .getState()
    .sync.queue.filter((m) => m.table === 'weight_log')
    .map((m) => ({ op: m.op, client_id: m.client_id, row: m.row }));
const press = async (name: string | RegExp) => {
  await act(async () => {
    await fireEvent.press(screen.getByRole('button', { name }));
  });
};
/** 28 days losing 0.1 kg/day, ending at 88.0 kg today-1. */
const FOUR_WEEKS: [number, number][] = Array.from({ length: 28 }, (_, i) => [
  i + 1,
  Math.round((88 + i * 0.1) * 10) / 10,
]);

describe('Weight screen', () => {
  it('not enough data: projection hidden under 14 points (F13 AC2)', async () => {
    const { store, at } = await todayStore({
      weights: [
        [3, 90.4],
        [2, 90.2],
        [1, 90.1, 'salty'],
      ],
    });
    await renderWithStore(store, <WeightScreen now={at('09:00')} />);
    expect(screen.getByTestId('not-enough')).toHaveTextContent(
      'Not enough data. 11 more weigh-ins in the last 4 weeks and the projection appears.',
    );
    expect(screen.getByText('90.2')).toBeOnTheScreen(); // 7-day avg tile
    expect(
      screen.getByText('Today’s deficit shows once dinner is logged, or from 9 pm.'),
    ).toBeOnTheScreen();
  });

  it('four weeks: tiles, chart, trend and intake projections, measured TDEE', async () => {
    const intake = Array.from({ length: 20 }, (_, i) => [i + 1, 2010] as [number, number]);
    const { store, at } = await todayStore({ weights: FOUR_WEEKS, intake });
    await renderWithStore(store, <WeightScreen now={at('21:30')} />);
    expect(screen.getByText('88.3')).toBeOnTheScreen();
    expect(screen.getByText('−0.6')).toBeOnTheScreen(); // vs last week: 88.3 vs 88.9
    expect(
      within(screen.getByTestId('projection')).getByText(/^Trend: 75 kg by /),
    ).toBeOnTheScreen();
    expect(within(screen.getByTestId('projection')).getByText(/^Intake-based: /)).toBeOnTheScreen();
    expect(screen.getByTestId('energy-card')).toBeOnTheScreen();
    expect(
      within(screen.getByTestId('measured')).getByText(
        /^Measured from your 4-week trend, real TDEE is about/,
      ),
    ).toBeOnTheScreen();

    await act(async () => {
      fireEvent(screen.getByTestId('weight-chart'), 'layout', {
        nativeEvent: { layout: { width: 340, height: 260 } },
      });
    });
    const day = screen.getAllByRole('button', { name: /: 88 kg, 7-day average/ })[0]!;
    await fireEvent.press(day);
    expect(screen.getByTestId('weight-tooltip')).toHaveTextContent(/88 kg · 7-day avg/);
    await fireEvent.press(screen.getByRole('radio', { name: '4W' }));
    expect(screen.getByRole('radio', { name: '4W' })).toHaveProp(
      'accessibilityState',
      expect.objectContaining({ selected: true }),
    );
  });

  it('weigh in: preview, salty marker, one per day (replaces), Undo', async () => {
    const { store, at, today } = await todayStore({ weights: FOUR_WEEKS });
    await renderWithStore(store, <WeightScreen now={at('06:05')} />);
    await press('Weigh in');
    const sheet = screen.getByTestId('weighin-sheet');
    await fireEvent.press(within(sheet).getByRole('button', { name: 'Minus 0.1 kilograms' }));
    expect(
      within(sheet).getByText(/^7-day average becomes 88\.\d kg \(−0\.\d vs last week\)/),
    ).toBeOnTheScreen();
    await fireEvent.press(within(sheet).getByLabelText('After a salty or late dinner'));
    await press('Save 87.9 kilograms');
    expect(weights(store)).toEqual([
      {
        op: 'upsert',
        client_id: expect.any(String),
        row: { date: today, weight_kg: 87.9, note: 'salty', deleted_at: null },
      },
    ]);

    // Editing today's weigh-in replaces the same row.
    await press('Weigh in');
    await fireEvent.press(
      within(screen.getByTestId('weighin-sheet')).getByRole('button', {
        name: 'Plus 0.1 kilograms',
      }),
    );
    await press('Save 88.0 kilograms');
    expect(weights(store)).toHaveLength(1);
    expect(weights(store)[0]?.row).toMatchObject({ weight_kg: 88, note: 'salty' });
    await press(/^Undo: 88\.0 kg saved/);
    expect(weights(store)[0]?.row).toMatchObject({ weight_kg: 87.9 });
  });

  it('no weigh-ins yet', async () => {
    const { store, at } = await todayStore();
    await renderWithStore(store, <WeightScreen now={at('09:00')} />);
    expect(screen.getByText('No weigh-ins yet')).toBeOnTheScreen();
    expect(screen.getByText('Log your first weigh-in to start the chart.')).toBeOnTheScreen();
    await press('Weigh in');
    expect(screen.getByRole('button', { name: 'Save 91.0 kilograms' })).toBeOnTheScreen();
  });
});
