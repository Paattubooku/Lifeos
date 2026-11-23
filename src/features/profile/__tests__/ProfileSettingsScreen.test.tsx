import { act, fireEvent, screen } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';

import { renderWithStore, seededStore } from '@/test/profileFixtures';

import { ProfileSettingsScreen } from '../components/ProfileSettingsScreen';

const mockRouter = { push: jest.fn(), back: jest.fn(), replace: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));

beforeEach(() => jest.clearAllMocks());

describe('ProfileSettingsScreen', () => {
  it('AC2: shows "Reminders off — enable" when permission is not granted', async () => {
    const { store } = await seededStore();
    await renderWithStore(store, <ProfileSettingsScreen />);
    expect(await screen.findByTestId('reminders-off')).toBeOnTheScreen();
    expect(screen.getByText('Reminders off — enable')).toBeOnTheScreen();

    await act(async () => {
      await fireEvent.press(screen.getByRole('button', { name: 'Enable reminders' }));
    });
    expect(Notifications.requestPermissionsAsync).toHaveBeenCalled();
    expect(await screen.findByLabelText('Reminders on')).toBeOnTheScreen();
  });

  it('Save is disabled until something changes', async () => {
    const { store } = await seededStore();
    await renderWithStore(store, <ProfileSettingsScreen />);
    const save = screen.getByRole('button', { name: 'Save profile' });
    expect(save).toBeDisabled();
    expect(screen.getByText('No changes')).toBeOnTheScreen();
  });

  it('AC3: changing wake time queues the profile + every wake block, nothing else', async () => {
    const { store } = await seededStore();
    await renderWithStore(store, <ProfileSettingsScreen />);
    await fireEvent.press(screen.getByRole('radio', { name: 'Wake, 5:00 am' }));
    await fireEvent.press(screen.getByLabelText('Wake hour 6'));
    expect(screen.getByText('Save')).toBeOnTheScreen();

    await act(async () => {
      await fireEvent.press(screen.getByRole('button', { name: 'Save profile' }));
    });

    const queue = store.getState().sync.queue;
    expect(queue.map((m) => [m.table, m.client_id, m.row])).toEqual([
      ['profile', 'profile-c', expect.objectContaining({ wake_time: '06:00' })],
      ['routine_block', 'wd-wake-c', expect.objectContaining({ start_time: '06:00' })],
      ['routine_block', 'we-wake-c', expect.objectContaining({ start_time: '06:00' })],
      ['routine_block', 'rd-wake-c', expect.objectContaining({ start_time: '06:00' })],
    ]);
    expect(queue.some((m) => m.client_id === 'wd-water-c')).toBe(false);
    expect(await screen.findByText('Profile saved')).toBeOnTheScreen();
    expect(mockRouter.back).toHaveBeenCalled();
  });

  it('Close goes back without saving', async () => {
    const { store } = await seededStore();
    await renderWithStore(store, <ProfileSettingsScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Close profile settings' }));
    expect(mockRouter.back).toHaveBeenCalled();
    expect(store.getState().sync.queue).toHaveLength(0);
  });

  it('a new current weight logs today and the screen reflects the queued write', async () => {
    const { store, today } = await seededStore();
    await renderWithStore(store, <ProfileSettingsScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Increase Current weight' }));
    await act(async () => {
      await fireEvent.press(screen.getByRole('button', { name: 'Save profile' }));
    });
    const weight = store.getState().sync.queue.find((m) => m.table === 'weight_log');
    expect(weight?.row).toEqual({ date: today, weight_kg: 91.1 });
  });
});
