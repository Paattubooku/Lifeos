import { act, fireEvent, screen, within } from '@testing-library/react-native';

import { renderWithStore } from '@/test/profileFixtures';
import { todayStore } from '@/test/todayFixtures';

import { ExerciseHistoryScreen } from '../components/ExerciseHistoryScreen';
import { ExercisesScreen } from '../components/ExercisesScreen';
import { SessionScreen } from '../components/SessionScreen';
import { ticks } from '../components/TrendChart';

const mockRouter = { push: jest.fn(), back: jest.fn(), replace: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));

beforeEach(() => jest.clearAllMocks());

const settle = () => act(async () => undefined);
// Every bench set hit 12 at 14 kg, 7 and 14 days ago.
const PAST: [number, string, number, number | null, number | null][] = [
  [14, 'bench', 1, 13, 12],
  [14, 'bench', 2, 13, 11],
  [14, 'bench', 3, 13, 10],
  [7, 'bench', 1, 14, 12],
  [7, 'bench', 2, 14, 12],
  [7, 'bench', 3, 14, 12],
];

describe('overload chip in the logger', () => {
  it('shows "Try 15 kg" and one tap applies it', async () => {
    const { store, today } = await todayStore({ pastSets: PAST });
    await renderWithStore(store, <SessionScreen date={today} />);
    await settle();
    const chip = screen.getByTestId('overload-chip');
    expect(within(chip).getByText('Try 15 kg')).toBeOnTheScreen();
    expect(within(chip).getByText('Every set hit 12 last time at 14 kg.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Log set 1' })).toHaveTextContent(
      'Log set 1 · 14 kg × 12',
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Apply suggestion: Try 15 kg' }));
    expect(screen.getByRole('button', { name: 'Log set 1' })).toHaveTextContent(
      'Log set 1 · 15 kg × 12',
    );
    expect(screen.queryByRole('button', { name: /Apply suggestion/ })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'DB bench press. History' }));
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/exercise/[id]',
      params: { id: 'bench' },
    });
  });

  it('no chip without history', async () => {
    const { store, today } = await todayStore();
    await renderWithStore(store, <SessionScreen date={today} />);
    await settle();
    expect(screen.queryByTestId('overload-chip')).toBeNull();
  });
});

describe('exercise history screen', () => {
  it('tiles, trend (tap a point), sessions table', async () => {
    const { store, at } = await todayStore({ pastSets: PAST });
    await renderWithStore(store, <ExerciseHistoryScreen id="bench" now={at('09:00')} />);
    expect(screen.getByRole('header', { name: 'DB bench press' })).toBeOnTheScreen();
    expect(screen.getByText('14 × 12')).toBeOnTheScreen(); // best set
    expect(screen.getByText('19.6')).toBeOnTheScreen(); // 14 × (1 + 12/30)
    expect(screen.getByText('+8%')).toBeOnTheScreen(); // 18.2 → 19.6
    const table = screen.getByTestId('history-table');
    expect(within(table).getByText('14×12 · 14×12 · 14×12')).toBeOnTheScreen();
    expect(within(table).getByText('504 kg')).toBeOnTheScreen();

    await act(async () => {
      fireEvent(screen.getByTestId('trend-chart'), 'layout', {
        nativeEvent: { layout: { width: 320, height: 180 } },
      });
    });
    const points = screen.getAllByRole('button', { name: /kg, 1\d × 1\d on/ });
    expect(points).toHaveLength(2);
    await fireEvent.press(points[0]!);
    expect(screen.getByTestId('trend-tooltip')).toHaveTextContent(/18.2 kg · 13 × 12 on/);
  });

  it('empty history', async () => {
    const { store, at } = await todayStore();
    await renderWithStore(store, <ExerciseHistoryScreen id="row" now={at('09:00')} />);
    expect(screen.getByText('No sets logged yet')).toBeOnTheScreen();
  });

  it('library rows open the history', async () => {
    const { store, at } = await todayStore();
    await renderWithStore(store, <ExercisesScreen now={at('09:00')} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Plank. History' }));
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/exercise/[id]',
      params: { id: 'plank' },
    });
  });
});

describe('chart ticks', () => {
  it('3–5 nice steps covering the range', () => {
    expect(ticks(13.9, 20)).toEqual([12, 14, 16, 18, 20]);
    expect(ticks(18.2, 19.6)).toEqual([18, 18.5, 19, 19.5, 20]);
    expect(ticks(5, 5)).toEqual([5]);
  });
});
