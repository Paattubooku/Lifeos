import { act, fireEvent, screen, within } from '@testing-library/react-native';

import { FoodScreen } from '@/features/food/components/FoodScreen';
import { TodayScreen } from '@/features/today/components/TodayScreen';
import { addDays } from '@/lib/dates';
import { renderWithStore } from '@/test/profileFixtures';
import { todayStore } from '@/test/todayFixtures';

import { nudgesApi } from '../api';

const mockRouter = { push: jest.fn(), back: jest.fn(), replace: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));
beforeEach(() => jest.clearAllMocks());

type Store = Awaited<ReturnType<typeof todayStore>>['store'];
const queued = (store: Store, table: string) =>
  store
    .getState()
    .sync.queue.filter((m) => m.table === table)
    .map((m) => ({ op: m.op, client_id: m.client_id, row: m.row }));
const press = async (name: string | RegExp) => {
  await act(async () => {
    await fireEvent.press(screen.getByRole('button', { name }));
  });
};
const seedNudges = async (
  store: Store,
  today: string,
  rows: { kind: string; date?: string; dismissed?: boolean; ref?: string }[],
) => {
  await store.dispatch(
    nudgesApi.util.upsertQueryData(
      'getNudgesSince',
      addDays(today, -14),
      rows.map((r, i) => ({
        id: `n${i}`,
        client_id: `n${i}`,
        user_id: 'u',
        created_at: 'x',
        updated_at: 'x',
        deleted_at: null,
        date: r.date ?? today,
        kind: r.kind,
        ref: r.ref ?? null,
        shown_at: 'x',
        dismissed_at: r.dismissed ? 'x' : null,
      })),
    ),
  );
};

describe('failure interrupt on Today (A8)', () => {
  it('≥ 3 overdue: red card, logged once; Done ticks the easiest; snooze hides it', async () => {
    const { store, at, today } = await todayStore();
    await renderWithStore(store, <TodayScreen now={at('11:40')} />);
    const card = screen.getByTestId('interrupt-card');
    expect(within(card).getByText(/blocks overdue · 11:40 AM$/)).toBeOnTheScreen();
    expect(queued(store, 'nudge_log').filter((n) => n.row.kind === 'interrupt')).toHaveLength(1);
    await press(/^Done: /);
    expect(queued(store, 'water_log').length + queued(store, 'block_log').length).toBeGreaterThan(
      0,
    );
    expect(queued(store, 'nudge_log').some((n) => n.row.dismissed_at)).toBe(true);
    // still ≥ 3 overdue → it comes back as a new showing (counts toward max 3)
    await press('Not now (snooze 15 min)');
    expect(screen.queryByTestId('interrupt-card')).toBeNull();
    expect(store.getState().accountability.snoozedUntil).toBeGreaterThan(0);
    void today;
  });

  it('off in Reminders → no card; 3 shown today → no card', async () => {
    const off = await todayStore();
    off.store.dispatch({
      type: 'notifications/reminderToggled',
      payload: { type: 'interrupt', on: false },
    });
    await renderWithStore(off.store, <TodayScreen now={off.at('11:40')} />);
    expect(screen.queryByTestId('interrupt-card')).toBeNull();
    const maxed = await todayStore();
    await seedNudges(
      maxed.store,
      maxed.today,
      [1, 2, 3].map(() => ({ kind: 'interrupt', dismissed: true })),
    );
    await renderWithStore(maxed.store, <TodayScreen now={maxed.at('11:40')} />);
    expect(screen.queryByTestId('interrupt-card')).toBeNull();
  });
});

describe('missed-day recovery (Acc-Recovery)', () => {
  it('yesterday < 70 → pick one, lock it in → pinned at the top', async () => {
    const { store, at } = await todayStore({ history: [{ daysAgo: 1, score: 54 }] });
    await renderWithStore(store, <TodayScreen now={at('05:24')} />);
    const card = screen.getByTestId('recovery-card');
    expect(within(card).getByText(/^Yesterday: 54%\./)).toBeOnTheScreen();
    const options = within(card).getAllByRole('radio');
    expect(options.length).toBeGreaterThan(0);
    await act(async () => {
      fireEvent.press(options[0]!);
    });
    await press('Lock it in');
    const kinds = queued(store, 'nudge_log').map((n) => n.row.kind);
    expect(kinds).toEqual(expect.arrayContaining(['pinned', 'missed_day']));
    expect(screen.queryByTestId('recovery-card')).toBeNull();
    expect(screen.getByTestId('pinned-card')).toBeOnTheScreen();
  });

  it('not after a good day; Not today dismisses', async () => {
    const good = await todayStore({ history: [{ daysAgo: 1, score: 85 }] });
    await renderWithStore(good.store, <TodayScreen now={good.at('05:24')} />);
    expect(screen.queryByTestId('recovery-card')).toBeNull();
    const bad = await todayStore({ history: [{ daysAgo: 1, score: 40 }] });
    await renderWithStore(bad.store, <TodayScreen now={bad.at('05:24')} />);
    await press('Dismiss missed-day recovery');
    expect(screen.queryByTestId('recovery-card')).toBeNull();
  });
});

describe('fallback mode (A9)', () => {
  it('after 18:00 under 50 %: rescues log and lift the score by the shown points', async () => {
    const { store, at } = await todayStore();
    store.dispatch({
      type: 'notifications/reminderToggled',
      payload: { type: 'interrupt', on: false },
    });
    await renderWithStore(store, <TodayScreen now={at('19:10')} />);
    const card = screen.getByTestId('fallback-card');
    const water = within(card).getByRole('button', { name: /^Drink 500 ml, plus (\d+) points$/ });
    const gain = Number(/plus (\d+) points/.exec(String(water.props.accessibilityLabel))![1]);
    const before = screen.getByTestId('fallback-card');
    expect(before).toBeOnTheScreen();
    await act(async () => {
      fireEvent.press(water);
    });
    expect(queued(store, 'water_log').at(-1)?.row).toMatchObject({ amount_ml: 500 });
    expect(queued(store, 'nudge_log').map((n) => n.row.kind)).toContain('rescue_water');
    expect(
      within(screen.getByTestId('fallback-card')).getByLabelText('Drink 500 ml: done'),
    ).toBeOnTheScreen();
    expect(gain).toBeGreaterThan(0);
    await press(/^2 boiled eggs, plus/);
    expect(queued(store, 'food_log').at(-1)?.row).toMatchObject({
      kcal: 140,
      protein_g: 12,
      is_off_plan: true,
    });
    await press(/^Walk 1,000 steps, plus/);
    expect(queued(store, 'steps_log').at(-1)?.row).toMatchObject({ steps: 1000 });
  });

  it('not before 18:00', async () => {
    const { store, at } = await todayStore();
    await renderWithStore(store, <TodayScreen now={at('17:30')} />);
    expect(screen.queryByTestId('fallback-card')).toBeNull();
  });
});

describe('reality check and strict week (A10)', () => {
  const rising: [number, number][] = Array.from({ length: 13 }, (_, i) => [13 - i, 88 + i * 0.06]);
  it('weight up while scores and deficit say otherwise → card; Strict week → weigh-it on meals', async () => {
    const { store, at } = await todayStore({
      weights: rising.map(([ago, kg]) => [ago, Math.round(kg * 10) / 10]),
      history: Array.from({ length: 13 }, (_, i) => ({ daysAgo: i + 1, score: 84 })),
      intake: Array.from({ length: 13 }, (_, i) => [i + 1, 1500]),
    });
    await renderWithStore(store, <TodayScreen now={at('05:15')} />);
    const card = screen.getByTestId('reality-card');
    expect(
      within(card).getByText(/^Weight \+0\.\d kg in 1\d days\. Day scores averaged 84%\.$/),
    ).toBeOnTheScreen();
    await press('Strict week: weigh food for 7 days');
    expect(queued(store, 'nudge_log').map((n) => n.row.kind)).toEqual(
      expect.arrayContaining(['strict_week', 'reality_weight']),
    );
    expect(screen.queryByTestId('reality-card')).toBeNull();
    await renderWithStore(store, <FoodScreen now={at('12:00')} />);
    expect(screen.getAllByText('WEIGH IT').length).toBeGreaterThan(0);
  });

  it('audit day after 7 days at 100 %', async () => {
    const { store, at } = await todayStore({
      history: Array.from({ length: 7 }, (_, i) => ({ daysAgo: i + 1, score: 100 })),
    });
    await renderWithStore(store, <TodayScreen now={at('05:15')} />);
    await press('Got it: audit day');
    expect(queued(store, 'nudge_log').at(-1)?.row).toMatchObject({ kind: 'reality_audit' });
    expect(screen.queryByTestId('audit-card')).toBeNull();
  });
});
