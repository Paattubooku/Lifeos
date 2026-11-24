import { fireEvent, screen } from '@testing-library/react-native';

import { addDays } from '@/lib/dates';
import { renderWithStore } from '@/test/profileFixtures';
import { todayStore } from '@/test/todayFixtures';
import { palettes } from '@/ui';

import { heatColor } from '../components/MiniCharts';
import { ProgressScreen } from '../components/ProgressScreen';

const mockRouter = { push: jest.fn(), back: jest.fn(), replace: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));

beforeEach(() => jest.clearAllMocks());

const label = (id: string) => screen.getByTestId(id).props.accessibilityLabel as string;

describe('Progress tab (F16)', () => {
  it('AC1: every section renders an empty state with no data', async () => {
    const { store, at } = await todayStore();
    await renderWithStore(store, <ProgressScreen now={at('12:00')} />);
    expect(label('progress-weight')).toMatch(/^Weight: —, No weigh-ins yet\. No trend yet/);
    expect(label('progress-streaks')).toMatch(/^Streaks: 0 days, best 0 · grace 0 used/);
    expect(label('progress-food')).toMatch(/^Food: —, Nothing logged in the last week\. 0 of 14/);
    expect(label('progress-train')).toMatch(/^Training: 0 \/ 6, sessions this week\./);
    expect(label('progress-sleep')).toMatch(/^Sleep: —, No nights logged yet\./);
    expect(label('progress-water')).toMatch(/^Water: —, No water logged last week\./);
    for (const id of [
      'mini-line',
      'food-kcal-bars',
      'train-bars',
      'sleep-mini-bars',
      'water-mini-bars',
    ])
      expect(screen.queryByTestId(id, { includeHiddenElements: true })).toBeNull();
    expect(screen.getByTestId('mini-heat', { includeHiddenElements: true })).toBeOnTheScreen();
  });

  it('with data: headline numbers, charts and links', async () => {
    const { store, at, today } = await todayStore({
      weights: [
        [10, 90],
        [5, 89.5],
        [1, 89],
      ],
      history: [
        { daysAgo: 1, score: 92 },
        { daysAgo: 2, score: 75 },
        { daysAgo: 3, score: 40 },
      ],
      nutrition: [
        [1, 2000, 150],
        [2, 2200, 130],
      ],
      sessions: [
        [1, 100],
        [8, 90],
        [9, 50],
      ],
      sleep: [
        [1, '22:00', '05:00', true],
        [2, '23:00', '05:00', null],
      ],
      waterHistory: [
        { daysAgo: 1, ml: 3000 },
        { daysAgo: 2, ml: 2000 },
      ],
    });
    await renderWithStore(store, <ProgressScreen now={at('12:00')} />);
    expect(label('progress-weight')).toMatch(/^Weight: 89\.\d kg, 7-day avg/);
    expect(label('progress-weight')).toContain('+0.7 total');
    expect(screen.getByTestId('mini-line', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(label('progress-streaks')).toMatch(/^Streaks: 2 days, best 2/);
    expect(label('progress-food')).toMatch(/^Food: 2,100, kcal · 7-day avg · protein 140 g/);
    expect(label('progress-food')).toContain('2 of 14 days logged');
    expect(label('progress-train')).toMatch(
      /Sessions per week, last 8 weeks: 0, 0, 0, 0, 0, 0, \d, \d/,
    );
    expect(label('progress-sleep')).toMatch(/^Sleep: 6\.5 h, 7-day avg · target 7 h/);
    expect(label('progress-water')).toMatch(
      /^Water: 2,500, ml · 7-day avg · goal 3,000, 1 of 7 hit/,
    );

    // AC2: the heatmap cells follow day_log.score (92 → 90+, 75 → 70–79, 40 → < 50).
    const cell = (ago: number, band: string) =>
      screen.getByTestId(`heat-${addDays(today, -ago)}-${band}`, { includeHiddenElements: true });
    expect(cell(1, '90plus')).toBeTruthy();
    expect(cell(2, '70to79')).toBeTruthy();
    expect(cell(3, 'lt50')).toBeTruthy();
    expect(cell(4, 'none')).toBeTruthy();
    expect(heatColor('90plus', palettes.dark)).toBe(palettes.dark.buttonPrimary);
    expect(heatColor('none', palettes.light)).toBe(palettes.light.hairline);

    fireEvent.press(screen.getByTestId('progress-sleep'));
    expect(mockRouter.push).toHaveBeenLastCalledWith('/sleep');
    fireEvent.press(screen.getByTestId('progress-weight'));
    expect(mockRouter.push).toHaveBeenLastCalledWith('/weight');
    fireEvent.press(screen.getByTestId('progress-streaks'));
    expect(mockRouter.push).toHaveBeenLastCalledWith('/streaks');
    fireEvent.press(screen.getByTestId('progress-food'));
    expect(mockRouter.push).toHaveBeenLastCalledWith('/food');
    fireEvent.press(screen.getByTestId('progress-train'));
    expect(mockRouter.push).toHaveBeenLastCalledWith('/train');
    fireEvent.press(screen.getByTestId('progress-water'));
    expect(mockRouter.push).toHaveBeenLastCalledWith('/water');
  });
});
