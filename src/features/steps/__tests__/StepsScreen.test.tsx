import * as HK from '@kingstinct/react-native-healthkit';
import { act, fireEvent, screen, within } from '@testing-library/react-native';

import { ProgressScreen } from '@/features/progress/components/ProgressScreen';
import { TodayScreen } from '@/features/today/components/TodayScreen';
import { autoStatus } from '@/features/today/lib/auto';
import { addDays } from '@/lib/dates';
import { renderWithStore } from '@/test/profileFixtures';
import { todayStore } from '@/test/todayFixtures';

import { StepsScreen } from '../components/StepsScreen';
import { resetHealth } from '../lib/health';

const mockRouter = { push: jest.fn(), back: jest.fn(), replace: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));
const hk = jest.mocked(HK);

beforeEach(() => {
  jest.clearAllMocks();
  resetHealth(() => Promise.resolve(HK));
  hk.isHealthDataAvailable.mockReturnValue(false);
});

type Store = Awaited<ReturnType<typeof todayStore>>['store'];
const queued = (store: Store) =>
  store
    .getState()
    .sync.queue.filter((m) => m.table === 'steps_log')
    .map((m) => ({ client_id: m.client_id, row: m.row }));
const press = async (name: string | RegExp) => {
  await act(async () => {
    await fireEvent.press(screen.getByRole('button', { name }));
  });
};

describe('Steps without Health (Expo Go / denied): manual entry (F21 AC)', () => {
  it('quick add, set total, hint; Connect Health explains the dev build', async () => {
    const { store, at, today } = await todayStore({
      steps: [
        [1, 6500],
        [2, 3000],
      ],
    });
    await renderWithStore(store, <StepsScreen now={at('18:00')} />);
    expect(screen.getByTestId('steps-hint')).toHaveTextContent(
      '6,000 steps left: a 60-min walk after dinner.',
    );
    await press('Add 2,000 steps');
    await press('Add 1,000 steps');
    expect(queued(store).at(-1)).toMatchObject({
      row: { date: today, steps: 3000, source: 'manual' },
    });
    expect(screen.getByTestId('steps-hint')).toHaveTextContent(
      '3,000 steps left: a 30-min walk after dinner.',
    );
    await press('Set today’s total');
    await press('Increase Today’s steps');
    await press('Save today’s steps');
    expect(queued(store).at(-1)?.row).toMatchObject({ steps: 3500 });
    expect(new Set(queued(store).map((q) => q.client_id)).size).toBe(1);
    expect(screen.getByLabelText('7-day avg, 4,750, steps')).toBeOnTheScreen();
    expect(screen.getByLabelText('Days ≥ 6,000, 1 / 7, last week')).toBeOnTheScreen();

    await press('Connect Health');
    expect(screen.getByText(/needs the LifeOS development build/)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Connect Health' })).toBeOnTheScreen();
  });

  it('permission denied: stays manual with Connect Health and a hint', async () => {
    hk.isHealthDataAvailable.mockReturnValue(true);
    hk.requestAuthorization.mockRejectedValueOnce(new Error('denied'));
    const { store, at } = await todayStore();
    await renderWithStore(store, <StepsScreen now={at('10:00')} />);
    await press('Connect Health');
    expect(store.getState().steps.health).toBe('denied');
    expect(screen.getByText(/Health access was not given. Allow it in Settings/)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Add 500 steps' })).toBeOnTheScreen();
    expect(
      screen.getByText('No steps yet. Connect Health or add today’s steps.'),
    ).toBeOnTheScreen();
  });
});

describe('Steps from Apple Health', () => {
  it('connect reads 30 days and stores changed days as source=health', async () => {
    hk.isHealthDataAvailable.mockReturnValue(true);
    const { store, at, today } = await todayStore({ steps: [[1, 5000, 'health']] });
    const midnight = (d: string) => new Date(`${d}T00:00:00+05:30`);
    hk.queryStatisticsCollectionForQuantity.mockResolvedValue([
      {
        startDate: midnight(addDays(today, -1)),
        sumQuantity: { quantity: 5000, unit: 'count' },
        sources: [],
      },
      { startDate: midnight(today), sumQuantity: { quantity: 4210, unit: 'count' }, sources: [] },
    ] as never);
    await renderWithStore(store, <StepsScreen now={at('12:00')} />);
    await press('Connect Health');
    expect(hk.requestAuthorization).toHaveBeenCalledWith({
      toRead: ['HKQuantityTypeIdentifierStepCount'],
    });
    expect(queued(store)).toEqual([
      {
        client_id: expect.any(String),
        row: { date: today, steps: 4210, source: 'health', deleted_at: null },
      },
    ]);
    expect(screen.getByTestId('health-connected')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Add 500 steps' })).toBeNull();
    expect(screen.getByText(/^From Apple Health/)).toBeOnTheScreen();
  });

  it('Today refreshes from Health once per visit and shows the chip', async () => {
    hk.isHealthDataAvailable.mockReturnValue(true);
    const { store, at, today } = await todayStore();
    store.dispatch({ type: 'steps/healthLinked', payload: 'connected' });
    hk.queryStatisticsCollectionForQuantity.mockResolvedValue([
      {
        startDate: new Date(`${today}T00:00:00+05:30`),
        sumQuantity: { quantity: 812, unit: 'count' },
        sources: [],
      },
    ] as never);
    await renderWithStore(store, <TodayScreen now={at('12:00')} />);
    await act(async () => {});
    expect(hk.queryStatisticsCollectionForQuantity).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('steps-chip')).toBeOnTheScreen();
    expect(screen.getByLabelText('812 steps today of 6,000. Open Steps')).toBeOnTheScreen();
  });

  it('no chip on Today and a Connect hint on Progress when there are no steps', async () => {
    const { store, at } = await todayStore();
    await renderWithStore(store, <TodayScreen now={at('12:00')} />);
    expect(screen.queryByTestId('steps-chip')).toBeNull();
    await renderWithStore(store, <ProgressScreen now={at('12:00')} />);
    expect(
      within(screen.getByTestId('progress-steps')).getByText(/^Connect Health or add steps/),
    ).toBeOnTheScreen();
  });
});

describe('Steps routine block (optional kind)', () => {
  const block = {
    client_id: 'b',
    kind: 'steps',
    auto_complete: true,
    title: 'Steps',
    start_time: '19:00:00',
  };
  const base = { water: [], waterTargetMl: 3000, eatenSlots: new Set<string>(), session: null };
  it('auto-completes at the minimum', () => {
    expect(
      autoStatus(block as never, [], { ...base, steps: { count: 5999, min: 6000 } }),
    ).toMatchObject({
      done: false,
      hint: 'auto: 6,000 steps',
    });
    expect(
      autoStatus(block as never, [], { ...base, steps: { count: 6000, min: 6000 } }).done,
    ).toBe(true);
    expect(autoStatus(block as never, [], base).done).toBe(false);
  });
});
