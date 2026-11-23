import { act, fireEvent, screen, within } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';

import { TodayScreen } from '@/features/today/components/TodayScreen';
import { renderWithStore } from '@/test/profileFixtures';
import { todayStore } from '@/test/todayFixtures';

import { ExercisesScreen } from '../components/ExercisesScreen';
import { ProgramScreen } from '../components/ProgramScreen';
import { SessionScreen } from '../components/SessionScreen';
import { TrainScreen } from '../components/TrainScreen';

const mockRouter = { push: jest.fn(), back: jest.fn(), replace: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));

const N = Notifications as jest.Mocked<typeof Notifications>;
beforeEach(() => {
  jest.clearAllMocks();
  N.getPermissionsAsync.mockResolvedValue({ granted: true, canAskAgain: true } as never);
});
afterEach(() => N.getPermissionsAsync.mockReset());

type Store = Awaited<ReturnType<typeof todayStore>>['store'];
const q = (store: Store, table: string) =>
  store
    .getState()
    .sync.queue.filter((m) => m.table === table)
    .map((m) => ({ op: m.op, client_id: m.client_id, row: m.row }));
const press = async (name: string | RegExp) => {
  await act(async () => {
    await fireEvent.press(screen.getByRole('button', { name }));
  });
};
const settle = () => act(async () => undefined);

describe('Train tab', () => {
  it('strength day: today card with exercises and Start', async () => {
    const { store, at } = await todayStore();
    await renderWithStore(store, <TrainScreen now={at('05:20')} />);
    const card = screen.getByTestId('train-today');
    expect(within(card).getByText('Upper A')).toBeOnTheScreen();
    expect(within(card).getByText('2 exercises · ~10 min · 5 sets')).toBeOnTheScreen();
    expect(within(card).getByText('3 × 8–12')).toBeOnTheScreen();
    expect(within(card).getByText('2 × 8–12 / side')).toBeOnTheScreen();
    await press('Start Upper A');
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/session/[date]',
      params: { date: expect.any(String) },
    });
    expect(screen.getByTestId('train-week')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Program. Open' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/program');
  });

  it('walk day: "Done (30 min)" logs a finished session at 100 %', async () => {
    const { store, at } = await todayStore({ todaySession: 'd3' });
    await renderWithStore(store, <TrainScreen now={at('06:00')} />);
    await press('Walk done, 30 minutes');
    expect(q(store, 'session_log')[0]?.row).toMatchObject({
      workout_day_id: 'd3',
      completion: 100,
    });
    expect(screen.getByText('Done · walk logged')).toBeOnTheScreen();
  });

  it('rest day', async () => {
    const { store, at } = await todayStore({ todaySession: 'd7' });
    await renderWithStore(store, <TrainScreen now={at('06:00')} />);
    expect(screen.getByText('Rest day')).toBeOnTheScreen();
  });
});

describe('Session logger', () => {
  it('F11 AC1 + AC2: pre-fill from last time, then from the previous set; rest timer with a background notification', async () => {
    const { store, today } = await todayStore({
      pastSets: [
        [7, 'bench', 1, 14, 12],
        [7, 'bench', 2, 14, 11],
      ],
    });
    await renderWithStore(store, <SessionScreen date={today} />);
    await settle();
    expect(q(store, 'session_log')[0]?.row).toMatchObject({ workout_day_id: 'd1', completion: 0 });
    const panel = screen.getByTestId('exercise-panel');
    expect(within(panel).getByText('DB bench press')).toBeOnTheScreen();
    expect(within(panel).getByText('Set 1 of 3 · 8–12 · rest 90 s')).toBeOnTheScreen();
    expect(within(panel).getByText('14 kg × 12 · 14 kg × 11')).toBeOnTheScreen();

    await press('Log set 1');
    expect(q(store, 'set_log')[0]?.row).toMatchObject({
      exercise_id: 'bench',
      set_no: 1,
      weight_kg: 14,
      reps: 12,
    });
    // AC2: rest runs from timestamps and rings via a scheduled notification.
    expect(screen.getByTestId('rest-view')).toBeOnTheScreen();
    await settle();
    expect(N.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        identifier: 'rest-timer',
        content: expect.objectContaining({ title: 'Rest over' }),
      }),
    );
    await press('Add 15 seconds');
    expect(store.getState().train.rest?.totalSec).toBe(105);
    await press('Skip rest');
    expect(N.cancelScheduledNotificationAsync).toHaveBeenCalledWith('rest-timer');

    // AC1: set 2 starts from set 1's numbers.
    expect(screen.getByRole('button', { name: 'Log set 2' })).toHaveTextContent(
      'Log set 2 · 14 kg × 12',
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Decrease Reps' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Increase Weight' }));
    await press('Log set 2');
    await press('Skip rest');
    expect(screen.getByRole('button', { name: 'Log set 3' })).toHaveTextContent(
      'Log set 3 · 15 kg × 11',
    );
  });

  it('F11 AC3: reaching 80 % ticks Today’s workout block; finish shows the summary', async () => {
    const { store, today } = await todayStore();
    const view = await renderWithStore(store, <SessionScreen date={today} />);
    await settle();
    for (let i = 0; i < 4; i++) {
      await press(/^Log set \d$/);
      if (screen.queryByRole('button', { name: 'Skip rest' })) await press('Skip rest');
    }
    const session = q(store, 'session_log')[0];
    expect(session?.row.completion).toBe(80);
    await view.unmount();

    await renderWithStore(store, <TodayScreen />);
    expect(
      screen.getByRole('button', { name: /^\d+:\d+ [ap]m, Workout · Upper A, done/ }),
    ).toBeOnTheScreen();

    await renderWithStore(store, <SessionScreen date={today} />);
    await press('Finish session');
    expect(screen.getByTestId('summary')).toBeOnTheScreen();
    expect(screen.getByTestId('ticked')).toBeOnTheScreen();
    expect(screen.getByText('Upper A done')).toBeOnTheScreen();
    await press('Done');
    expect(mockRouter.back).toHaveBeenCalled();
  });

  it('switching exercise via the strip; leaving keeps the session to resume', async () => {
    const { store, today } = await todayStore();
    await renderWithStore(store, <SessionScreen date={today} />);
    await settle();
    await fireEvent.press(screen.getByRole('tab', { name: 'Row' }));
    expect(
      within(screen.getByTestId('exercise-panel')).getByText('One-arm DB row'),
    ).toBeOnTheScreen();
    expect(screen.getByText(/kg per hand · per side/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Close session' }));
    expect(mockRouter.back).toHaveBeenCalled();
  });

  it('timed exercise (plank): start, stop & log seconds', async () => {
    const { store, today } = await todayStore({ todaySession: 'd2' });
    await renderWithStore(store, <SessionScreen date={today} />);
    await settle();
    await press('Start holding set 1');
    expect(store.getState().train.hold).toMatchObject({ exerciseId: 'plank', setNo: 1 });
    await press(/^Stop and log \d+ seconds$/);
    expect(q(store, 'set_log')[0]?.row).toMatchObject({
      exercise_id: 'plank',
      reps: null,
      weight_kg: null,
      duration_sec: expect.any(Number),
    });
    expect(store.getState().train.hold).toBeNull();
  });

  it('circuit: rounds × stations, rest between rounds, all rounds done', async () => {
    const { store, today } = await todayStore({ todaySession: 'd6' });
    await renderWithStore(store, <SessionScreen date={today} />);
    await settle();
    expect(screen.getByRole('header', { name: 'Round 1 of 2' })).toBeOnTheScreen();
    await press('Station done, DB thruster');
    expect(screen.queryByTestId('rest-view')).toBeNull(); // no rest between stations
    await press('Station done, Push-up');
    expect(screen.getByTestId('rest-view')).toBeOnTheScreen(); // 60 s between rounds
    await press('Skip rest');
    expect(screen.getByRole('header', { name: 'Round 2 of 2' })).toBeOnTheScreen();
    await press('Station done, DB thruster');
    await press('Station done, Push-up');
    expect(screen.getByTestId('circuit-done')).toBeOnTheScreen();
    expect(q(store, 'set_log').map((s) => [s.row.exercise_id, s.row.set_no])).toEqual([
      ['thruster', 1],
      ['pushup', 1],
      ['thruster', 2],
      ['pushup', 2],
    ]);
    expect(q(store, 'session_log')[0]?.row.completion).toBe(100);
  });

  it('rest / walk days have no session to log', async () => {
    const { store, today } = await todayStore({ todaySession: 'd7' });
    await renderWithStore(store, <SessionScreen date={today} />);
    expect(screen.getByText('No session to log')).toBeOnTheScreen();
  });
});

describe('Program and exercise library', () => {
  it('program days with today marked; library grouped by muscle', async () => {
    const { store, at } = await todayStore();
    await renderWithStore(store, <ProgramScreen now={at('06:00')} />);
    expect(within(screen.getByTestId('program-1')).getByText('Upper A')).toBeOnTheScreen();
    expect(
      within(screen.getByTestId('program-6')).getByText('2 rounds · 2 stations · ~5 min'),
    ).toBeOnTheScreen();
    await renderWithStore(store, <ExercisesScreen now={at('06:00')} />);
    expect(
      within(screen.getByTestId('muscle-chest')).getByText('DB bench press'),
    ).toBeOnTheScreen();
    expect(within(screen.getByTestId('muscle-back')).getByText('per side')).toBeOnTheScreen();
  });
});
