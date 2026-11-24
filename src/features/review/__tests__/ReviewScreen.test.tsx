import { act, fireEvent, screen, within } from '@testing-library/react-native';

import { TodayScreen } from '@/features/today/components/TodayScreen';
import { ProgressScreen } from '@/features/progress/components/ProgressScreen';
import { addDays, todayLogical, weekStart } from '@/lib/dates';
import { renderWithStore } from '@/test/profileFixtures';
import { todayStore } from '@/test/todayFixtures';

import { reviewApi } from '../api';
import { ReviewScreen } from '../components/ReviewScreen';
import { ReviewsScreen } from '../components/ReviewsScreen';
import { reviewWeek } from '../lib/review';

const mockRouter = { push: jest.fn(), back: jest.fn(), replace: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));
beforeEach(() => jest.clearAllMocks());

const today = todayLogical();
const week = reviewWeek(today);
const rollup = (ws: string, score: number) => ({
  user_id: 'u',
  week_start: ws,
  avg_score: score,
  streak_days: 5,
  sessions: 4,
  avg_protein: 148,
  avg_kcal: 2040,
  weight_change: -0.5,
  avg_sleep_hours: 6.8,
  spend_inr: 6420,
});
type Store = Awaited<ReturnType<typeof todayStore>>['store'];
const queued = (store: Store) =>
  store
    .getState()
    .sync.queue.filter((m) => m.table === 'weekly_review')
    .map((m) => ({ client_id: m.client_id, row: m.row }));
const press = async (name: string | RegExp) => {
  await act(async () => {
    await fireEvent.press(screen.getByRole('button', { name }));
  });
};

describe('Weekly review (F20)', () => {
  it('numbers → reflect → saved in a few taps (AC: under 2 minutes)', async () => {
    const { store, at } = await todayStore();
    await store.dispatch(
      reviewApi.util.upsertQueryData('getRollup', addDays(week, -7), [
        rollup(week, 81),
        rollup(addDays(week, -7), 76),
      ]),
    );
    await renderWithStore(store, <ReviewScreen now={at('20:00')} />);
    expect(screen.getByText('Your week in numbers')).toBeOnTheScreen();
    expect(screen.getByText('Good')).toBeOnTheScreen();
    expect(screen.getByText('Avg day score 81% · last week 76% (+5)')).toBeOnTheScreen();
    expect(screen.getByLabelText('Streak days, 5, this week')).toBeOnTheScreen();
    expect(screen.getByLabelText('Sessions, 4, done ≥ 80%')).toBeOnTheScreen();
    expect(screen.getByLabelText('Weight, −0.5 kg, 7-day avg change')).toBeOnTheScreen();
    expect(screen.getByLabelText('Sleep avg, 6.8 h, target 7 h')).toBeOnTheScreen();
    expect(screen.getByLabelText('Spend, ₹6,420, debits this week')).toBeOnTheScreen();
    // No ticks in the fixture: the worst block is one of the hand-ticked blocks at 0 %.
    expect(within(screen.getByTestId('worst-block')).getByText('0%')).toBeOnTheScreen();

    await press('Next: reflect');
    await act(async () => {
      fireEvent.changeText(screen.getByLabelText('What went well'), 'All sessions done.');
    });
    await press(/^Use: .* every day$/);
    expect(screen.getByLabelText('What I change next week').props.value).toMatch(/ every day\.$/);
    await act(async () => {
      fireEvent.changeText(
        screen.getByLabelText('What I change next week'),
        'Walk after dinner at 8:30 pm.',
      );
    });
    await press('Save review');
    expect(queued(store)).toEqual([
      {
        client_id: expect.any(String),
        row: expect.objectContaining({
          week_start: week,
          grade: 'Good',
          went_well: 'All sessions done.',
          change_next_week: 'Walk after dinner at 8:30 pm.',
          summary: expect.objectContaining({ avgScore: 81, prevScore: 76, spend: 6420 }),
        }),
      },
    ]);
    expect(screen.getByText('Done for this week')).toBeOnTheScreen();
    expect(screen.getByText('“Walk after dinner at 8:30 pm.”')).toBeOnTheScreen();
    expect(screen.getByText(/^Pinned to Today all week, starting /)).toBeOnTheScreen();
    // editing reuses the same row
    await press('Edit review');
    await press('Save review');
    const rows = queued(store);
    expect(rows.at(-1)!.client_id).toBe(rows[0]!.client_id);
  });

  it('works without the numbers (offline): still saves the reflection', async () => {
    const { store, at } = await todayStore({
      reviews: [{ week_start: week, went_well: 'Old', change_next_week: 'Old change' }],
    });
    await renderWithStore(store, <ReviewScreen now={at('20:00')} />);
    expect(screen.getByText('No score')).toBeOnTheScreen();
    await press('Next: reflect');
    expect(screen.getByLabelText('What went well').props.value).toBe('Old');
    await press('Save review');
    expect(queued(store)[0]).toMatchObject({ client_id: 'rv0', row: { grade: null } });
  });
});

describe('Pinned change and past reviews', () => {
  it('Today shows last week’s change all this week; tap opens reviews', async () => {
    // The review saved for the week before this one is pinned all this week.
    const { store, at } = await todayStore({
      reviews: [
        {
          week_start: addDays(weekStart(today), -7),
          change_next_week: 'Walk after dinner at 8:30 pm.',
          summary: { avgSleep: 6.8, worst: { title: 'Evening walk', pct: 29 } },
        },
      ],
    });
    await renderWithStore(store, <TodayScreen now={at('05:20')} />);
    const card = screen.getByTestId('change-card');
    expect(within(card).getByText('Walk after dinner at 8:30 pm.')).toBeOnTheScreen();
    expect(within(card).getByText('Last week: Evening walk 29% · Sleep 6.8 h')).toBeOnTheScreen();
    await act(async () => {
      fireEvent.press(card);
    });
    expect(mockRouter.push).toHaveBeenCalledWith('/reviews');
  });

  it('no change card without a review for last week', async () => {
    const { store, at } = await todayStore();
    await renderWithStore(store, <TodayScreen now={at('05:20')} />);
    expect(screen.queryByTestId('change-card')).toBeNull();
  });

  it('reviews list and the Progress tab entry points', async () => {
    const { store, at } = await todayStore({
      reviews: [
        {
          week_start: '2026-11-16',
          grade: 'Good',
          went_well: 'Packed lunch',
          change_next_week: 'Walk',
          summary: { avgScore: 84 },
        },
        {
          week_start: '2026-11-09',
          grade: 'Needs work',
          summary: { avgScore: 61, worst: { title: 'Phone away', pct: 14 } },
        },
      ],
    });
    await renderWithStore(store, <ReviewsScreen now={at('12:00')} />);
    expect(screen.getByText('2 reviews · Sundays at 8:00 pm')).toBeOnTheScreen();
    const first = screen.getByTestId('review-2026-11-16');
    expect(within(first).getByText('84% · Good')).toBeOnTheScreen();
    expect(
      within(screen.getByTestId('review-2026-11-09')).getByText('Worst block: Phone away 14%'),
    ).toBeOnTheScreen();

    await renderWithStore(store, <ProgressScreen now={at('12:00')} />);
    await press('Weekly review');
    expect(mockRouter.push).toHaveBeenLastCalledWith('/review');
    await act(async () => {
      fireEvent.press(screen.getByTestId('progress-reviews'));
    });
    expect(mockRouter.push).toHaveBeenLastCalledWith('/reviews');
  });
});
