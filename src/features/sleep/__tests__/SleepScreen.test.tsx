import { act, fireEvent, screen } from '@testing-library/react-native';

import { TodayScreen } from '@/features/today/components/TodayScreen';
import { renderWithStore } from '@/test/profileFixtures';
import { todayStore } from '@/test/todayFixtures';

import { ScreenTimeScreen } from '../components/ScreenTimeScreen';
import { SleepScreen } from '../components/SleepScreen';

const mockRouter = { push: jest.fn(), back: jest.fn(), replace: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));

beforeEach(() => jest.clearAllMocks());

type Store = Awaited<ReturnType<typeof todayStore>>['store'];
const writes = (store: Store, table: string) =>
  store
    .getState()
    .sync.queue.filter((m) => m.table === table)
    .map((m) => ({ client_id: m.client_id, row: m.row }));
const press = async (name: string | RegExp) => {
  await act(async () => {
    await fireEvent.press(screen.getByRole('button', { name }));
  });
};

describe('morning check on Today (F14)', () => {
  it('shows after wake time; Correct logs last night and ticks Wake (AC1, AC2)', async () => {
    const { store, at, today } = await todayStore();
    await renderWithStore(store, <TodayScreen now={at('05:12')} />);
    expect(screen.getByText('Morning check · 5:12 am')).toBeOnTheScreen();
    expect(screen.getByText('Went to bed 10:00 pm, woke 5:10 am')).toBeOnTheScreen();
    expect(screen.getByText('7 h 10 m · on your 10:00 pm target.')).toBeOnTheScreen();
    await press(/^Correct/);
    const [night] = writes(store, 'sleep_log');
    expect(night?.row).toMatchObject({ date: today, deleted_at: null });
    expect(Date.parse(String(night?.row.wake_at)) - Date.parse(String(night?.row.bed_at))).toBe(
      (7 * 60 + 10) * 60e3,
    );
    expect(writes(store, 'block_log').at(-1)?.row).toMatchObject({ date: today, status: 'done' });
    expect(screen.queryByTestId('morning-check')).toBeNull();
  });

  it('not before wake time, and not once last night is logged', async () => {
    const { store, at } = await todayStore({ sleep: [[0, '22:40', '05:05', null]] });
    await renderWithStore(store, <TodayScreen now={at('06:00')} />);
    expect(screen.queryByTestId('morning-check')).toBeNull();
    const early = await todayStore();
    await renderWithStore(early.store, <TodayScreen now={early.at('04:30')} />);
    expect(screen.queryByTestId('morning-check')).toBeNull();
  });

  it('Adjust: woke late does not tick Wake', async () => {
    const { store, at } = await todayStore();
    await renderWithStore(store, <TodayScreen now={at('06:00')} />);
    await press('Adjust bed and wake times');
    expect(screen.getByTestId('sleep-sheet')).toBeOnTheScreen();
    await press('Save sleep');
    expect(writes(store, 'sleep_log')).toHaveLength(1);
    expect(writes(store, 'block_log')).toHaveLength(0);
  });

  it('ticking Phone away marks tonight (the next morning’s row); Undo clears it', async () => {
    const { store, at, today } = await todayStore();
    await renderWithStore(store, <TodayScreen now={at('21:40')} />);
    await press(/, Phone away, /);
    const [w] = writes(store, 'sleep_log');
    expect(w?.row).toMatchObject({ phone_off_kept: true });
    expect(w?.row.date).not.toBe(today);
    await press(/^Undo: Phone away done/);
    expect(writes(store, 'sleep_log').at(-1)).toMatchObject({
      client_id: w?.client_id,
      row: { phone_off_kept: false },
    });
  });
});

describe('Sleep screen', () => {
  it('tiles, chart, consistency, table', async () => {
    const { store, at } = await todayStore({
      sleep: [
        [0, '22:40', '05:05', true],
        [1, '22:00', '05:00', false],
        [2, '00:20', '05:20', null],
      ],
    });
    await renderWithStore(store, <SleepScreen now={at('07:00')} />);
    expect(screen.getByText('Target 10:00 pm → 5:00 am · 7 h')).toBeOnTheScreen();
    expect(screen.queryByTestId('morning-check')).toBeNull();
    expect(screen.getByLabelText('7-day avg, 6.1 h, target 7 h')).toBeOnTheScreen();
    expect(screen.getByLabelText('Nights ≥ 7 h, 1 / 14, last 2 weeks')).toBeOnTheScreen();
    expect(screen.getByLabelText('Bedtime, ±59 min, avg 11:00 pm')).toBeOnTheScreen();
    expect(screen.getByTestId('consistency-text')).toHaveTextContent(
      'Average bedtime 11:00 pm, 60 min late. The 9:30 pm phone-away block was done on 1 of 14 nights.',
    );
    await press('Show nights table');
    expect(screen.getByTestId('sleep-table')).toBeOnTheScreen();
    await press('Screen Time setup. Downtime / Bedtime mode on your phone');
    expect(mockRouter.push).toHaveBeenCalledWith('/settings/screen-time');
  });

  it('empty state', async () => {
    const { store, at } = await todayStore();
    await renderWithStore(store, <SleepScreen now={at('13:00')} />);
    expect(screen.getByText(/Log a night to start the chart/)).toBeOnTheScreen();
    expect(screen.getByLabelText('Bedtime, —, log 2+ nights')).toBeOnTheScreen();
  });
});

describe('Screen Time setup', () => {
  it('iOS and Android steps with the profile times', async () => {
    const { store } = await todayStore();
    await renderWithStore(store, <ScreenTimeScreen />);
    expect(screen.getByText('Choose Every Day, From 9:30 pm, To 5:00 am.')).toBeOnTheScreen();
    expect(
      screen.getByText('Choose Use a schedule, Every day, 9:30 pm to 5:00 am.'),
    ).toBeOnTheScreen();
  });
});
