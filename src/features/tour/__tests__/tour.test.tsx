import { act, fireEvent, screen } from '@testing-library/react-native';

import { profileRow, renderWithStore, seededStore } from '@/test/profileFixtures';

import { TourScreen } from '../components/TourScreen';
import { clampIndex, TOUR } from '../lib/slides';

const mockRouter = { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));

beforeEach(() => jest.clearAllMocks());

const press = async (name: string) => {
  await act(async () => {
    await fireEvent.press(screen.getByRole('button', { name }));
  });
};
const tourWrites = (store: Awaited<ReturnType<typeof seededStore>>['store']) =>
  store.getState().sync.queue.filter((m) => m.table === 'profile' && 'tour_seen_at' in m.row);

describe('tour content', () => {
  it('covers every area once, each with 2–4 how-to lines', () => {
    expect(TOUR.map((s) => s.id)).toEqual([
      'welcome',
      'today',
      'water',
      'food',
      'train',
      'body',
      'sleep',
      'steps',
      'life',
      'progress',
      'nudges',
      'ready',
    ]);
    for (const s of TOUR) {
      expect(s.how.length).toBeGreaterThanOrEqual(2);
      expect(s.how.length).toBeLessThanOrEqual(4);
    }
    expect(clampIndex(-1)).toBe(0);
    expect(clampIndex(99)).toBe(TOUR.length - 1);
  });
});

describe('TourScreen', () => {
  it('first run: Next / Back move pages; the last page finishes, marks it seen, goes to Today', async () => {
    mockRouter.canGoBack.mockReturnValue(false);
    const { store } = await seededStore();
    await renderWithStore(store, <TourScreen />);
    expect(screen.getByLabelText(`Page 1 of ${TOUR.length}`)).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Previous page' })).toBeNull();
    await press('Next page');
    expect(screen.getByLabelText(`Page 2 of ${TOUR.length}`)).toBeOnTheScreen();
    await press('Previous page');
    expect(screen.getByLabelText(`Page 1 of ${TOUR.length}`)).toBeOnTheScreen();
    for (let i = 1; i < TOUR.length; i++) await press('Next page');
    expect(screen.queryByRole('button', { name: 'Skip the tour' })).toBeNull();
    await press('Finish the tour and start my day');
    expect(tourWrites(store)).toHaveLength(1);
    expect(mockRouter.replace).toHaveBeenCalledWith('/today');
  });

  it('Skip also counts as seen', async () => {
    mockRouter.canGoBack.mockReturnValue(false);
    const { store } = await seededStore();
    await renderWithStore(store, <TourScreen />);
    await press('Skip the tour');
    expect(tourWrites(store)).toHaveLength(1);
    expect(mockRouter.replace).toHaveBeenCalledWith('/today');
  });

  it('replay from More: nothing is written again and it goes back', async () => {
    mockRouter.canGoBack.mockReturnValue(true);
    const { store } = await seededStore(profileRow({ tour_seen_at: '2026-11-24T10:00:00Z' }));
    await renderWithStore(store, <TourScreen />);
    expect(screen.getByText('Your whole day, one app')).toBeOnTheScreen();
    await press('Skip the tour');
    expect(tourWrites(store)).toHaveLength(0);
    expect(mockRouter.back).toHaveBeenCalled();
  });
});
