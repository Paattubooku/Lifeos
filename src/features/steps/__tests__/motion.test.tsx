import { act, fireEvent, screen } from '@testing-library/react-native';
import { Pedometer } from 'expo-sensors';

import { TodayScreen } from '@/features/today/components/TodayScreen';
import { addDays, istDate } from '@/lib/dates';
import { renderWithStore } from '@/test/profileFixtures';
import { todayStore } from '@/test/todayFixtures';

import { StepsScreen } from '../components/StepsScreen';
import { dayWindows } from '../lib/motion';

const mockRouter = { push: jest.fn(), back: jest.fn(), replace: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));
const pedo = jest.mocked(Pedometer);

beforeEach(() => jest.clearAllMocks());

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

/** Fake Core Motion: steps per IST day keyed by the window's start. */
const perDay = (counts: Record<string, number>) =>
  pedo.getStepCountAsync.mockImplementation(async (start: Date) => {
    const date = istDate(start);
    return { steps: counts[date] ?? 0 };
  });

describe('day windows', () => {
  it('7 IST days, today ending now', () => {
    const now = Date.parse('2026-11-24T12:00:00+05:30');
    const w = dayWindows(7, now);
    expect(w.map((x) => x.date)).toEqual([
      '2026-11-18',
      '2026-11-19',
      '2026-11-20',
      '2026-11-21',
      '2026-11-22',
      '2026-11-23',
      '2026-11-24',
    ]);
    expect(w[0]!.start.toISOString()).toBe('2026-11-17T18:30:00.000Z');
    expect(w[5]!.end.toISOString()).toBe('2026-11-23T18:30:00.000Z');
    expect(w[6]!.end.getTime()).toBe(now);
  });
});

describe('Automatic steps from the iPhone motion chip (free, Expo Go)', () => {
  it('Count steps automatically → permission → 7 days stored as source=phone; live count', async () => {
    const { store, at, today } = await todayStore({ steps: [[2, 9000, 'manual']] });
    perDay({ [today]: 3200, [addDays(today, -1)]: 7400, [addDays(today, -2)]: 8000 });
    let onSteps: (r: { steps: number }) => void = () => undefined;
    pedo.watchStepCount.mockImplementation((cb) => {
      onSteps = cb as typeof onSteps;
      return { remove: jest.fn() } as never;
    });
    await renderWithStore(store, <StepsScreen now={at('18:00')} />);
    await press('Count steps automatically');
    expect(pedo.requestPermissionsAsync).toHaveBeenCalled();
    expect(store.getState().steps.motion).toBe('on');
    // 7 reads (one per day); 2 days ago keeps the higher manual 9,000.
    expect(pedo.getStepCountAsync.mock.calls.length).toBeGreaterThanOrEqual(7);
    expect(queued(store).map((q) => [q.row.date, q.row.steps, q.row.source])).toEqual([
      [addDays(today, -1), 7400, 'phone'],
      [today, 3200, 'phone'],
    ]);
    expect(screen.getByTestId('motion-on')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Add 500 steps' })).toBeNull();
    await act(async () => {});
    await act(async () => onSteps({ steps: 150 }));
    expect(screen.getByText('Counting live on this iPhone')).toBeOnTheScreen();
    expect(screen.getByLabelText(/^3,350 steps today/)).toBeOnTheScreen();
  });

  it('Motion & Fitness refused: manual stays, with how to turn it on', async () => {
    pedo.requestPermissionsAsync.mockResolvedValueOnce({ granted: false } as never);
    const { store, at } = await todayStore();
    await renderWithStore(store, <StepsScreen now={at('10:00')} />);
    await press('Count steps automatically');
    expect(store.getState().steps.motion).toBe('denied');
    expect(screen.getByText(/Motion & Fitness is off for this app/)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Add 500 steps' })).toBeOnTheScreen();
  });

  it('no motion chip: says so and stays manual', async () => {
    pedo.isAvailableAsync.mockResolvedValueOnce(false);
    const { store, at } = await todayStore();
    await renderWithStore(store, <StepsScreen now={at('10:00')} />);
    await press('Count steps automatically');
    expect(store.getState().steps.motion).toBe('off');
    expect(screen.getByText('This phone can’t count steps. Enter them by hand.')).toBeOnTheScreen();
  });

  it('Today reads the iPhone counts once per visit and shows the chip', async () => {
    const { store, at, today } = await todayStore();
    store.dispatch({ type: 'steps/motionLinked', payload: 'on' });
    perDay({ [today]: 4210 });
    await renderWithStore(store, <TodayScreen now={at('12:00')} />);
    await act(async () => {});
    expect(queued(store)).toEqual([
      {
        client_id: expect.any(String),
        row: { date: today, steps: 4210, source: 'phone', deleted_at: null },
      },
    ]);
    expect(screen.getByLabelText('4,210 steps today of 6,000. Open Steps')).toBeOnTheScreen();
  });

  it('turn off returns to manual entry', async () => {
    const { store, at } = await todayStore();
    store.dispatch({ type: 'steps/motionLinked', payload: 'on' });
    await renderWithStore(store, <StepsScreen now={at('10:00')} />);
    await press('Turn off automatic step counting');
    expect(store.getState().steps.motion).toBe('off');
    expect(screen.getByRole('button', { name: 'Add 500 steps' })).toBeOnTheScreen();
  });
});
