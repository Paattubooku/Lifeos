import { fireEvent, screen, within } from '@testing-library/react-native';

import { TemplateScreen } from '@/features/routine/components/TemplateScreen';
import { addDays, isoWeekday } from '@/lib/dates';
import { renderWithStore } from '@/test/profileFixtures';
import { todayStore } from '@/test/todayFixtures';

import { StreaksScreen } from '../components/StreaksScreen';
import { TodayScreen } from '../components/TodayScreen';
import { shortDay } from '../lib/present';

const mockRouter = { push: jest.fn(), back: jest.fn(), replace: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));

beforeEach(() => jest.clearAllMocks());

describe('F06 on Today', () => {
  it('shows the streak line and opens Streaks', async () => {
    const { store, at, today } = await todayStore({
      history: [
        { daysAgo: 3, score: 80 },
        { daysAgo: 2, score: 60 },
        { daysAgo: 1, score: 90 },
      ],
    });
    await renderWithStore(store, <TodayScreen now={at('13:15')} />);
    const line = screen.getByRole('button', { name: /Open streaks$/ });
    expect(line).toHaveProp(
      'accessibilityLabel',
      `3-day streak · grace used ${shortDay(addDays(today, -2))}. Open streaks`,
    );
    await fireEvent.press(line);
    expect(mockRouter.push).toHaveBeenCalledWith('/streaks');
  });

  it('finalises past days on open: yesterday and unscored days, from that day’s logs', async () => {
    const { store, today } = await todayStore({
      history: [
        { daysAgo: 4, score: null, template_id: 'workday' },
        { daysAgo: 1, score: null, template_id: 'workday' },
      ],
      doneBlocks: [{ daysAgo: 1, blockId: 'workday-0' }],
    });
    const { at } = { at: (h: string) => Date.parse(`${today}T${h}:00+05:30`) };
    await renderWithStore(store, <TodayScreen now={at('09:00')} />);
    const writes = store.getState().sync.queue.filter((m) => m.table === 'day_log');
    expect(writes.find((w) => w.client_id === 'h1-c')?.row).toMatchObject({
      date: addDays(today, -1),
      // Wake ticked; on a Sunday the rest-day workout block also counts as done.
      score: isoWeekday(addDays(today, -1)) === 7 ? 18 : 9,
      is_streak_day: false,
    });
    expect(writes.find((w) => w.client_id === 'h4-c')?.row).toMatchObject({ score: 0 });
    expect(writes.find((w) => w.client_id === 'dl-c')?.row).toMatchObject({ score: 0 });
  });
});

describe('Streaks screen', () => {
  it('current / best / grace, heatmap, last break, rules', async () => {
    const { store, at, today } = await todayStore({
      history: [
        { daysAgo: 6, score: 44 },
        { daysAgo: 5, score: 82 },
        { daysAgo: 4, score: 91 },
        { daysAgo: 3, score: 58 },
        { daysAgo: 2, score: 75 },
        { daysAgo: 1, score: 88 },
      ],
    });
    await renderWithStore(store, <StreaksScreen now={at('13:15')} />);
    expect(screen.getByRole('header', { name: 'Streaks' })).toBeOnTheScreen();
    expect(
      screen.getByText(`days · since ${addDays(today, -5).slice(8).replace(/^0/, '')}`, {
        exact: false,
      }),
    ).toBeOnTheScreen();
    expect(screen.getByText('1 used')).toBeOnTheScreen();
    expect(screen.getByText(`${shortDay(addDays(today, -3))} · 58%`)).toBeOnTheScreen();
    const map = screen.getByTestId('heatmap');
    expect(within(map).getByLabelText(`${shortDay(addDays(today, -4))}: 91%`)).toBeOnTheScreen();
    expect(
      within(map).getByLabelText(`${shortDay(addDays(today, -3))}: 58%, grace day`),
    ).toBeOnTheScreen();
    expect(within(map).getByLabelText(`${shortDay(today)}: 0%, today`)).toBeOnTheScreen();
    expect(within(map).getByText('30-day avg 63%')).toBeOnTheScreen();
    expect(screen.getByText(`${shortDay(addDays(today, -6))} · 44%.`)).toBeOnTheScreen();
    expect(screen.getByText(/One grace day per 14 days/)).toBeOnTheScreen();
  });

  it('empty history', async () => {
    const { store, at } = await todayStore();
    await renderWithStore(store, <StreaksScreen now={at('13:15')} />);
    expect(screen.getByText('no streak yet')).toBeOnTheScreen();
    expect(screen.getByText('1 left')).toBeOnTheScreen();
    expect(screen.getByText('none used')).toBeOnTheScreen();
  });
});

describe('per-block streaks in the routine editor', () => {
  it('"Wake up" ticked 3 days running shows "· 3 days"', async () => {
    const { store } = await todayStore({
      doneBlocks: [1, 2, 3].map((daysAgo) => ({ daysAgo, blockId: 'workday-0' })),
    });
    await renderWithStore(store, <TemplateScreen id="workday" />);
    expect(
      screen.getByRole('button', { name: /^5:00 am, Wake up, Habit · 10 min · 3 days\. Edit$/ }),
    ).toBeOnTheScreen();
  });
});
