import { act, fireEvent, screen } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';

import { seededStore, renderWithStore } from '@/test/profileFixtures';

import { clampStep, OnboardingScreen } from '../components/OnboardingScreen';

const mockRouter = { push: jest.fn(), back: jest.fn(), replace: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));

beforeEach(() => jest.clearAllMocks());

const queued = (store: Awaited<ReturnType<typeof seededStore>>['store']) =>
  store.getState().sync.queue.map((m) => ({ table: m.table, client_id: m.client_id, row: m.row }));

describe('clampStep', () => {
  it('accepts 1–4 and falls back to 1', () => {
    expect(clampStep('3')).toBe(3);
    expect(clampStep(['2'])).toBe(2);
    expect(clampStep('9')).toBe(1);
    expect(clampStep(undefined)).toBe(1);
  });
});

describe('OnboardingScreen', () => {
  it('step 1: prefilled from the profile, steppers update the draft, Continue → step 2', async () => {
    const { store } = await seededStore();
    await renderWithStore(store, <OnboardingScreen step={1} />);
    expect(screen.getByRole('header', { name: 'Body' })).toBeOnTheScreen();
    expect(screen.getByLabelText('Step 1 of 4')).toBeOnTheScreen();
    expect(screen.getByRole('adjustable', { name: 'Height' })).toHaveAccessibilityValue({
      text: '170 cm',
    });
    expect(screen.getByText(/32 weeks \(early/)).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Decrease Current weight' }));
    expect(store.getState().profile.draft?.current_weight_kg).toBe(90.9);
    expect(screen.getByRole('button', { name: 'Back' })).toBeDisabled();

    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/onboarding/[step]',
      params: { step: '2' },
    });
  });

  it('step 2: picking a row and a time; invalid times block Continue', async () => {
    const { store } = await seededStore();
    await renderWithStore(store, <OnboardingScreen step={2} />);
    expect(
      screen.getByText('Sleep window: 7 h 0 min. Phone-off is 30 min before sleep.'),
    ).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('radio', { name: 'Sleep, 10:00 pm' }));
    await fireEvent.press(screen.getByLabelText('Sleep hour 4'));
    expect(store.getState().profile.draft?.sleep_time).toBe('16:00');
    expect(screen.getByTestId('day-error')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();

    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(mockRouter.back).toHaveBeenCalled();
  });

  it('step 3: deficit banner and "Use 2,000" sets the kcal target', async () => {
    const { store } = await seededStore();
    await renderWithStore(store, <OnboardingScreen step={3} />);
    expect(screen.getByText('~350 kcal deficit ≈ 0.3 kg/week')).toBeOnTheScreen();
    expect(screen.getByText('Est. maintenance ~2,550 kcal')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Use 2000 kilocalories' }));
    expect(store.getState().profile.draft?.kcal_target).toBe(2000);
    expect(screen.getByRole('adjustable', { name: 'Calories' })).toHaveAccessibilityValue({
      text: '2,000 kcal',
    });
  });

  it('step 4 "Not now" (AC2): finishes without asking for permission; AC1 writes are queued', async () => {
    const { store, today } = await seededStore();
    await renderWithStore(store, <OnboardingScreen step={4} />);
    expect(
      screen.getByLabelText(/^Template: (Workday \(Mon–Fri\)|Weekend \(Sat–Sun\))$/),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText('Targets: 3,000 ml · 2,200 kcal · 150 g')).toBeOnTheScreen();

    await act(async () => {
      await fireEvent.press(screen.getByRole('button', { name: 'Skip notifications and finish' }));
    });

    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
    const writes = queued(store);
    const profile = writes.find((w) => w.table === 'profile');
    expect(profile?.client_id).toBe('profile-c');
    expect(typeof profile?.row.onboarded_at).toBe('string');
    expect(profile?.row.start_weight_kg).toBe(91);
    expect(writes.find((w) => w.table === 'weight_log')?.row).toEqual({
      date: today,
      weight_kg: 91,
    });
    expect(writes.find((w) => w.table === 'day_log')?.row).toMatchObject({ date: today });
    expect(writes.find((w) => w.table === 'workout_program')?.client_id).toBe('prog-c');
    expect(store.getState().profile.draft).toBeNull();
    expect(mockRouter.replace).toHaveBeenCalledWith('/today');
  });

  it('step 4 "Allow notifications" asks the OS first', async () => {
    const { store } = await seededStore();
    await renderWithStore(store, <OnboardingScreen step={4} />);
    await act(async () => {
      await fireEvent.press(screen.getByRole('button', { name: 'Allow notifications and finish' }));
    });
    expect(Notifications.requestPermissionsAsync).toHaveBeenCalled();
    expect(mockRouter.replace).toHaveBeenCalledWith('/today');
  });
});
