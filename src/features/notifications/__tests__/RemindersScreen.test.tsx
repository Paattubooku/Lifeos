import { act, fireEvent, screen, within } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';
import { Text } from 'react-native';

import { FoodScreen } from '@/features/food/components/FoodScreen';
import { useFood } from '@/features/food/hooks/useFood';
import { useToday } from '@/features/today/hooks/useToday';
import { useWater } from '@/features/water/hooks/useWater';
import { renderWithStore } from '@/test/profileFixtures';
import { todayStore } from '@/test/todayFixtures';

import { RemindersScreen } from '../components/RemindersScreen';
import { useReminderSchedule } from '../hooks/useReminderSchedule';

const mockRouter = { push: jest.fn(), back: jest.fn(), replace: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));

beforeEach(() => jest.clearAllMocks());

describe('Reminders screen', () => {
  it('today’s count vs the cap, per-type switches, quiet today', async () => {
    const { store, at, today } = await todayStore();
    await renderWithStore(store, <RemindersScreen now={at('04:00')} />);
    const count = screen.getByTestId('reminder-count');
    expect(within(count).getByText('Today: 10 of 10 scheduled')).toBeOnTheScreen();
    expect(screen.getByTestId('reminders-off')).toBeOnTheScreen();

    await fireEvent(screen.getByTestId('toggle-meals'), 'valueChange', false);
    expect(store.getState().notifications.enabled.meals).toBe(false);
    expect(within(count).getByText('Today: 10 of 10 scheduled')).toBeOnTheScreen(); // water checks fill in

    await fireEvent(screen.getByTestId('toggle-water'), 'valueChange', false);
    expect(within(count).getByText('Today: 6 of 10 scheduled')).toBeOnTheScreen();

    await fireEvent(screen.getByTestId('toggle-quiet'), 'valueChange', true);
    expect(store.getState().notifications.quietDate).toBe(today);
    expect(within(count).getByText('Today: 0 of 10 scheduled')).toBeOnTheScreen();
    await fireEvent(screen.getByTestId('toggle-quiet'), 'valueChange', false);
    expect(store.getState().notifications.quietDate).toBeNull();

    await act(async () => {
      await fireEvent.press(screen.getByRole('button', { name: 'Enable reminders' }));
    });
    expect(Notifications.requestPermissionsAsync).toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Back to More' }));
    expect(mockRouter.back).toHaveBeenCalled();
  });

  it('F15 AC2 end to end: logging breakfast at 06:30 removes the 07:00 reminder', async () => {
    const { store, at, today } = await todayStore();
    await renderWithStore(store, <Probe now={at('06:30')} />);
    expect(screen.getByTestId('ids').props.children).toContain(`${today}:meal:breakfast`);
    await renderWithStore(store, <FoodScreen now={at('06:30')} />);
    await act(async () => {
      await fireEvent.press(screen.getByRole('button', { name: 'Breakfast eaten as planned' }));
    });
    await renderWithStore(store, <Probe now={at('06:30')} />);
    const ids = screen.getAllByTestId('ids').at(-1)!.props.children as string;
    expect(ids).not.toContain(`${today}:meal:breakfast`);
    expect(ids).toContain(`${today}:meal:lunch`);
  });
});

/** Renders the live schedule's ids from the store's data. */
function Probe({ now }: { now: number }) {
  const t = useToday(now);
  const food = useFood(now);
  const water = useWater(now);
  const reminders = useReminderSchedule({ t, food, water });
  return <Text testID="ids">{reminders.map((r) => r.id).join(',')}</Text>;
}
