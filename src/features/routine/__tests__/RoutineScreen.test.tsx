import { act, fireEvent, screen, within } from '@testing-library/react-native';

import { queueUpsert } from '@/features/sync/slice';
import { isoWeekday } from '@/lib/dates';
import { renderWithStore } from '@/test/profileFixtures';
import { routineStore, seedRoutine } from '@/test/routineFixtures';

import { RoutineScreen } from '../components/RoutineScreen';
import { blocksLeft } from '../components/SwitchTemplateSheet';

const mockRouter = { push: jest.fn(), back: jest.fn(), replace: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));

beforeEach(() => jest.clearAllMocks());

describe('RoutineScreen', () => {
  it('shows the week strip and the three templates; today’s is marked active', async () => {
    const { store, today } = await routineStore();
    await renderWithStore(store, <RoutineScreen />);
    expect(screen.getByLabelText('Monday: Workday')).toBeOnTheScreen();
    expect(screen.getByLabelText('Sunday: Weekend')).toBeOnTheScreen();
    expect(
      screen.getByText('W = Workday · E = Weekend · Rest day is applied by hand from Today'),
    ).toBeOnTheScreen();
    expect(screen.getByText('Mon–Fri · 12 blocks · 5:00 am – 10:00 pm')).toBeOnTheScreen();
    expect(screen.getByText('Sat–Sun · 11 blocks · 5:00 am – 10:00 pm')).toBeOnTheScreen();
    expect(screen.getByText('Manual · 11 blocks · 5:00 am – 10:00 pm')).toBeOnTheScreen();
    const active = isoWeekday(today) <= 5 ? 'Workday' : 'Weekend';
    expect(
      screen.getByRole('button', { name: new RegExp(`^${active}, active today`) }),
    ).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: /^Rest day\./ }));
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/routine/[id]',
      params: { id: 'rest' },
    });
    await fireEvent.press(screen.getByRole('button', { name: 'Back to More' }));
    expect(mockRouter.back).toHaveBeenCalled();
  });

  it('New creates a template and opens it', async () => {
    const { store } = await routineStore();
    await renderWithStore(store, <RoutineScreen />);
    await act(async () => {
      await fireEvent.press(screen.getByRole('button', { name: 'New template' }));
    });
    const [w] = store.getState().sync.queue;
    expect(w).toMatchObject({
      table: 'routine_template',
      row: { name: 'New template', weekdays: [] },
    });
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/routine/[id]',
      params: { id: w?.row.id },
    });
  });

  it('AC2: switching today to Rest day stores it on today’s day_log and drops the workout', async () => {
    const { store, today } = await routineStore();
    await renderWithStore(store, <RoutineScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Switch template for today' }));
    const sheet = screen.getByTestId('switch-sheet');
    await fireEvent.press(within(sheet).getByRole('radio', { name: 'Rest day' }));
    expect(within(sheet).getByText(/blocks? left today change/)).toBeOnTheScreen();
    await act(async () => {
      await fireEvent.press(within(sheet).getByRole('button', { name: 'Switch to Rest day' }));
    });
    const queue = store.getState().sync.queue;
    expect(queue).toHaveLength(1);
    expect(queue[0]).toMatchObject({
      table: 'day_log',
      row: { date: today, template_id: 'rest', deleted_at: null },
    });
    expect(await screen.findByText('Today runs Rest day')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: /^Rest day, active today/ })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Switch template for today' })).toHaveTextContent(
      /Rest day/,
    );
  });

  it('From now on also gives today’s weekday to the chosen template', async () => {
    const { store, today } = await routineStore();
    await renderWithStore(store, <RoutineScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Switch template for today' }));
    const sheet = screen.getByTestId('switch-sheet');
    await fireEvent.press(within(sheet).getByRole('radio', { name: 'Rest day' }));
    await fireEvent.press(within(sheet).getByRole('radio', { name: 'From now on' }));
    expect(within(sheet).getByText(/from now on run Rest day/)).toBeOnTheScreen();
    await act(async () => {
      await fireEvent.press(within(sheet).getByRole('button', { name: 'Switch to Rest day' }));
    });
    const rest = store.getState().sync.queue.find((m) => m.client_id === 'rest-c');
    expect(rest?.row.weekdays).toEqual([isoWeekday(today)]);
  });

  it('cancel closes the sheet without writing', async () => {
    const { store } = await routineStore();
    await renderWithStore(store, <RoutineScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Switch template for today' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByTestId('switch-sheet')).toBeNull();
    expect(store.getState().sync.queue).toHaveLength(0);
  });

  it('warns about a doubly-claimed weekday and lists archived templates', async () => {
    const { store } = await routineStore();
    await act(async () => {
      await store.dispatch(
        queueUpsert({
          table: 'routine_template',
          clientId: 'rest-c',
          row: { weekdays: [6], updated_at: '2026-11-22T00:00:00Z' },
        }),
      );
      await store.dispatch(
        queueUpsert({
          table: 'routine_template',
          clientId: 'weekend-c',
          row: { weekdays: [7], archived_at: null },
        }),
      );
    });
    await renderWithStore(store, <RoutineScreen />);
    expect(screen.queryByTestId('conflict-6')).toBeNull();

    await act(async () => {
      await store.dispatch(
        queueUpsert({
          table: 'routine_template',
          clientId: 'weekend-c',
          row: { weekdays: [6, 7] },
        }),
      );
    });
    expect(screen.getByTestId('conflict-6')).toBeOnTheScreen();

    await act(async () => {
      await store.dispatch(
        queueUpsert({
          table: 'routine_template',
          clientId: 'rest-c',
          row: { archived_at: '2026-11-23T00:00:00Z' },
        }),
      );
    });
    expect(screen.getByText(/Kept for past days/)).toBeOnTheScreen();
    await act(async () => {
      await fireEvent.press(screen.getByRole('button', { name: 'Restore Rest day' }));
    });
    expect(
      store.getState().sync.queue.find((m) => m.client_id === 'rest-c')?.row.archived_at,
    ).toBeNull();
  });
});

describe('blocksLeft', () => {
  it('counts blocks still ahead today (late-night ones included)', () => {
    const { blocks } = seedRoutine();
    expect(blocksLeft(blocks, 'workday', Date.parse('2026-11-23T08:50:00Z'))).toBe(6); // 14:20 IST: snack onwards
    expect(blocksLeft(blocks, 'workday', Date.parse('2026-11-22T21:00:00Z'))).toBe(0); // 02:30 IST
  });
});
