import { act, fireEvent, screen, within } from '@testing-library/react-native';

import { addDays, isoWeekday } from '@/lib/dates';
import { renderWithStore } from '@/test/profileFixtures';
import { todayStore } from '@/test/todayFixtures';

import { TodayScreen } from '../components/TodayScreen';

const mockRouter = { push: jest.fn(), back: jest.fn(), replace: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));

beforeEach(() => jest.clearAllMocks());

type Store = Awaited<ReturnType<typeof todayStore>>['store'];
/** Queued writes except today's day_log (its live score is checked on its own). */
const queue = (store: Store) =>
  store
    .getState()
    .sync.queue.filter((m) => m.table !== 'day_log')
    .map((m) => ({ table: m.table, op: m.op, row: m.row }));
const dayLogWrite = (store: Store) =>
  store.getState().sync.queue.find((m) => m.table === 'day_log');
const ring = () => screen.getByLabelText(/^Day score/);
const row = (title: string) =>
  screen.getByRole('button', { name: new RegExp(`^\\d+:\\d+ [ap]m, ${title},`) });

describe('TodayScreen', () => {
  it('header, ring, NOW card and timeline at 5:20 am', async () => {
    const { store, at } = await todayStore();
    await renderWithStore(store, <TodayScreen now={at('05:20')} />);
    expect(screen.getByRole('header', { name: '5:20 am' })).toBeOnTheScreen();
    expect(screen.getByText(/· 0 OF 11 DONE$/)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: /^Template Workday/ })).toBeOnTheScreen();
    expect(ring()).toHaveProp(
      'accessibilityLabel',
      expect.stringMatching(/^Day score 0%\. Routine 0 of 11/),
    );
    const now = screen.getByTestId('now-card');
    expect(within(now).getByText('Drink 500 ml water')).toBeOnTheScreen();
    expect(within(now).getByText('NOW · 5:10 AM')).toBeOnTheScreen();
    expect(within(now).getByText('until 5:40 am')).toBeOnTheScreen();
    expect(row('Workout · Upper A')).toHaveProp(
      'accessibilityLabel',
      '5:30 am, Workout · Upper A, next. 3 exercises · 60 min',
    );
    expect(row('Lunch')).toHaveProp(
      'accessibilityLabel',
      expect.stringContaining('Ponni rice, Chicken curry, Vegetable poriyal, Curd · 700 kcal'),
    );
    expect(row('Evening walk')).toHaveProp(
      'accessibilityLabel',
      expect.stringContaining('Optional · 30 min'),
    );
    expect(row('Wake up')).toHaveProp(
      'accessibilityLabel',
      '5:00 am, Wake up, due. Habit · 10 min · 10 min late',
    );
  });

  it('AC1: ticking a block updates the ring at once, is queued (offline) and can be undone', async () => {
    const { store, at, today } = await todayStore();
    await renderWithStore(store, <TodayScreen now={at('05:20')} />);
    await act(async () => {
      await fireEvent.press(row('Wake up'));
    });
    expect(queue(store)).toEqual([
      {
        table: 'block_log',
        op: 'upsert',
        row: expect.objectContaining({
          date: today,
          block_id: 'workday-0',
          status: 'done',
          deleted_at: null,
        }),
      },
    ]);
    expect(ring()).toHaveProp(
      'accessibilityLabel',
      expect.stringMatching(/^Day score 9%\. Routine 1 of 11/),
    );
    expect(row('Wake up')).toHaveProp(
      'accessibilityLabel',
      expect.stringMatching(/, done\. Done at /),
    );
    // F06: today's day_log follows the live score (reusing today's row).
    expect(dayLogWrite(store)).toMatchObject({
      client_id: 'dl-c',
      row: { score: 9, is_streak_day: false },
    });

    await act(async () => {
      await fireEvent.press(screen.getByRole('button', { name: /^Undo: Wake up done/ }));
    });
    expect(queue(store)).toEqual([]); // the unsynced tick is cancelled outright
    expect(ring()).toHaveProp('accessibilityLabel', expect.stringMatching(/^Day score 0%/));
  });

  it('untick a done block', async () => {
    const { store, at } = await todayStore();
    await renderWithStore(store, <TodayScreen now={at('05:20')} />);
    await act(async () => {
      await fireEvent.press(row('Wake up'));
    });
    await act(async () => {
      await fireEvent.press(row('Wake up'));
    });
    expect(queue(store)).toEqual([]);
    expect(screen.getByText('Wake up not done')).toBeOnTheScreen();
  });

  it('AC2: "Log 500 ml" auto-completes "Drink 500 ml water"', async () => {
    const { store, at } = await todayStore();
    await renderWithStore(store, <TodayScreen now={at('05:15')} />);
    await act(async () => {
      await fireEvent.press(screen.getByRole('button', { name: 'Log 500 ml of water' }));
    });
    expect(queue(store)).toEqual([
      { table: 'water_log', op: 'upsert', row: expect.objectContaining({ amount_ml: 500 }) },
    ]);
    expect(row('Drink 500 ml water')).toHaveProp(
      'accessibilityLabel',
      expect.stringMatching(/, done\. auto: 500 ml at /),
    );
    expect(ring()).toHaveProp(
      'accessibilityLabel',
      expect.stringMatching(/^Day score 9%\. Routine 1 of 11\. Water 17%/),
    );
    await act(async () => {
      await fireEvent.press(screen.getByRole('button', { name: /^Undo: 500 ml logged/ }));
    });
    expect(row('Drink 500 ml water')).toHaveProp(
      'accessibilityLabel',
      expect.stringContaining(', now. auto: 500 ml ·'),
    );
    await act(async () => {
      await fireEvent.press(screen.getByRole('button', { name: 'Log 500 ml of water' }));
    });
    // Tapping an auto-done block explains instead of unticking.
    await fireEvent.press(row('Drink 500 ml water'));
    expect(screen.getByText('Drink 500 ml water is done automatically')).toBeOnTheScreen();
    expect(queue(store)).toHaveLength(1);
  });

  it('long-press → skip with a reason leaves the score; Move to tomorrow shifts the week', async () => {
    const { store, at, today } = await todayStore();
    await renderWithStore(store, <TodayScreen now={at('05:20')} />);
    await fireEvent(row('Workout · Upper A'), 'longPress');
    const sheet = screen.getByTestId('skip-sheet');
    expect(
      within(sheet).getByRole('header', { name: 'Skip Workout · Upper A?' }),
    ).toBeOnTheScreen();
    const movable = isoWeekday(today) < 7;
    await fireEvent.press(within(sheet).getByRole('button', { name: 'Reason Travel' }));
    if (movable) {
      expect(within(sheet).getByText(/^Upper A moves to /)).toBeOnTheScreen();
      await fireEvent(within(sheet).getByTestId('toggle-move'), 'valueChange', true);
    } else {
      expect(within(sheet).queryByTestId('toggle-move')).toBeNull();
    }
    await act(async () => {
      await fireEvent.press(within(sheet).getByRole('button', { name: 'Skip, reason Travel' }));
    });
    const writes = queue(store);
    expect(writes[0]).toEqual({
      table: 'block_log',
      op: 'upsert',
      row: expect.objectContaining({ date: today, status: 'skipped', skip_reason: 'travel' }),
    });
    const overrides = writes.filter((w) => w.table === 'session_override');
    if (movable) {
      // Today's Upper A moves to tomorrow (Sundays have no move).
      expect(overrides[0]?.row).toEqual({
        date: addDays(today, 1),
        workout_day_id: 'd1',
        deleted_at: null,
      });
    } else {
      expect(overrides).toEqual([]);
    }
    expect(ring()).toHaveProp('accessibilityLabel', expect.stringMatching(/Routine 0 of 10/));
    expect(row('Workout · Upper A')).toHaveProp(
      'accessibilityLabel',
      expect.stringContaining('Skipped · travel'),
    );

    // Long-press again → Unskip.
    await fireEvent(row('Workout · Upper A'), 'longPress');
    await act(async () => {
      await fireEvent.press(screen.getByRole('button', { name: 'Unskip' }));
    });
    expect(ring()).toHaveProp('accessibilityLabel', expect.stringMatching(/Routine 0 of 11/));
  });

  it('Mark done / Skip from the NOW card; cancel closes the skip sheet', async () => {
    const { store, at } = await todayStore();
    await renderWithStore(store, <TodayScreen now={at('13:10')} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Skip Lunch' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByTestId('skip-sheet')).toBeNull();
    // F08: a meal block's NOW action logs the meal as planned, which ticks the block.
    await act(async () => {
      await fireEvent.press(screen.getByRole('button', { name: 'Lunch eaten as planned' }));
    });
    expect(queue(store).filter((w) => w.table === 'food_log')).toHaveLength(4);
    expect(row('Lunch')).toHaveProp('accessibilityLabel', expect.stringContaining(', done.'));
  });

  it('Mark done on a plain block', async () => {
    const { store, at } = await todayStore();
    await renderWithStore(store, <TodayScreen now={at('07:35')} />);
    await act(async () => {
      await fireEvent.press(screen.getByRole('button', { name: 'Mark Pack lunch box done' }));
    });
    expect(queue(store)[0]).toMatchObject({ table: 'block_log', row: { status: 'done' } });
  });

  it('shows what is next when nothing is current', async () => {
    const { store, at } = await todayStore();
    await renderWithStore(store, <TodayScreen now={at('09:00')} />);
    const next = screen.getByTestId('next-card');
    expect(within(next).getByText('Next · 1:00 pm')).toBeOnTheScreen();
    expect(within(next).getByText('in 4 h')).toBeOnTheScreen();
  });

  it('end of day from phone-off time: open items, weight, sleep, note', async () => {
    const { store, at, today } = await todayStore();
    await renderWithStore(store, <TodayScreen now={at('21:45')} />);
    const card = screen.getByTestId('end-of-day');
    expect(within(card).getByText('0%. 13 things left.')).toBeOnTheScreen();
    expect(within(card).getByText('Weight not logged')).toBeOnTheScreen();
    expect(screen.queryByTestId('now-card')).toBeNull();
    // Leading done rows fold away once 3+ are done.
    expect(screen.queryByRole('button', { name: /done, .* Show$/ })).toBeNull();

    await fireEvent.press(within(card).getByRole('button', { name: 'Log weight' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Decrease Weight' }));
    await act(async () => {
      await fireEvent.press(screen.getByRole('button', { name: 'Save 90.9 kilograms' }));
    });
    expect(queue(store).at(-1)).toMatchObject({
      table: 'weight_log',
      row: { date: today, weight_kg: 90.9 },
    });
    expect(within(screen.getByTestId('end-of-day')).queryByText('Weight not logged')).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Log sleep' }));
    expect(screen.getByText('7 h 0 min of sleep')).toBeOnTheScreen();
    await act(async () => {
      await fireEvent.press(screen.getByRole('button', { name: 'Save sleep' }));
    });
    const sleep = queue(store).at(-1);
    expect(sleep).toMatchObject({ table: 'sleep_log', row: { date: today } });
    expect(Date.parse(String(sleep?.row.wake_at)) - Date.parse(String(sleep?.row.bed_at))).toBe(
      7 * 3600e3,
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Write a note' }));
    await fireEvent.changeText(screen.getByLabelText('Note'), 'Long meeting day');
    await act(async () => {
      await fireEvent.press(screen.getByRole('button', { name: 'Save note' }));
    });
    expect(dayLogWrite(store)).toMatchObject({
      client_id: 'dl-c',
      row: { note: 'Long meeting day', score: 0 },
    });
    expect(screen.getByRole('button', { name: 'Edit today’s note' })).toBeOnTheScreen();
  });

  it('folds finished morning blocks', async () => {
    const { store, at } = await todayStore();
    await renderWithStore(store, <TodayScreen now={at('21:45')} />);
    for (const t of ['Wake up', 'Pack lunch box']) {
      await act(async () => {
        await fireEvent.press(row(t));
      });
    }
    await act(async () => {
      await fireEvent(row('Drink 500 ml water'), 'longPress');
    });
    await act(async () => {
      await fireEvent.press(screen.getByRole('button', { name: 'Skip, reason Sick' }));
    });
    // Wake, Drink (skipped) are first; Workout is still open → only 2 leading: no fold.
    expect(screen.queryByRole('button', { name: /^\d+ done,/ })).toBeNull();
    await act(async () => {
      await fireEvent.press(row('Workout · Upper A'));
    });
    const fold = screen.getByRole('button', {
      name: /^3 done, Wake up to Workout · Upper A\. Show$/,
    });
    await fireEvent.press(fold);
    expect(screen.getByRole('button', { name: /^3 done, .* Hide$/ })).toBeOnTheScreen();
  });

  it('template chip opens the switch sheet', async () => {
    const { store, at } = await todayStore();
    await renderWithStore(store, <TodayScreen now={at('05:20')} />);
    await fireEvent.press(screen.getByRole('button', { name: /^Template Workday/ }));
    expect(screen.getByTestId('switch-sheet')).toBeOnTheScreen();
  });
});
