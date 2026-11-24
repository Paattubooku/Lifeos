import { act, fireEvent, screen } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';

import { profileRow, renderWithStore, seededStore } from '@/test/profileFixtures';

import { EXAMPLE } from '../lib/onboarding';

import { clampStep, OnboardingScreen } from '../components/OnboardingScreen';

const mockRouter = { push: jest.fn(), back: jest.fn(), replace: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));

beforeEach(() => jest.clearAllMocks());

const queued = (store: Awaited<ReturnType<typeof seededStore>>['store']) =>
  store.getState().sync.queue.map((m) => ({ table: m.table, client_id: m.client_id, row: m.row }));

const NEW_USER = { height_cm: null, start_weight_kg: null, goal_weight_kg: null };
const type = async (label: string, text: string) => {
  await fireEvent.changeText(screen.getByLabelText(label), text);
};

describe('clampStep', () => {
  it('accepts 1–5 and falls back to 1', () => {
    expect(clampStep('5')).toBe(5);
    expect(clampStep(['2'])).toBe(2);
    expect(clampStep('9')).toBe(1);
    expect(clampStep(undefined)).toBe(1);
  });
});

describe('OnboardingScreen (F25: any new account)', () => {
  it('step 1 About you: blanks with example hints; Continue waits for valid answers', async () => {
    const { store } = await seededStore(profileRow(NEW_USER));
    await renderWithStore(store, <OnboardingScreen step={1} />);
    expect(screen.getByRole('header', { name: 'About you' })).toBeOnTheScreen();
    expect(screen.getByLabelText('Step 1 of 5')).toBeOnTheScreen();
    expect(screen.getByPlaceholderText('e.g. 1997')).toBeOnTheScreen();
    expect(screen.getByPlaceholderText('e.g. 170')).toBeOnTheScreen();
    expect(screen.getByText('Enter your birth year (1920–2015).')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Back' })).toBeDisabled();

    await type('Birth year', '1890');
    // No range warning while typing; it shows once the box is left.
    expect(screen.queryByText('1920–2015')).toBeNull();
    await fireEvent(screen.getByLabelText('Birth year'), 'blur');
    expect(screen.getByText('1920–2015')).toBeOnTheScreen();
    await type('Birth year', '1990');
    await type('Height (cm)', '162');
    await fireEvent.press(screen.getByRole('radio', { name: 'Female' }));
    await fireEvent.press(screen.getByRole('radio', { name: /^Active\./ }));
    expect(store.getState().profile.draft).toMatchObject({
      birth_year: 1990,
      height_cm: 162,
      sex: 'female',
      activity_factor: 1.55,
    });
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/onboarding/[step]',
      params: { step: '2' },
    });
  });

  it('typing a number updates the answers only when the value changes (not on every key)', async () => {
    const { store } = await seededStore(profileRow(NEW_USER));
    const spy = jest.spyOn(store, 'dispatch');
    await renderWithStore(store, <OnboardingScreen step={1} />);
    const updates = () =>
      spy.mock.calls.filter(([a]) => (a as { type?: string }).type === 'profile/draftUpdated')
        .length;
    for (const t of ['1', '19', '199']) await type('Birth year', t);
    expect(updates()).toBe(0);
    await type('Birth year', '1990');
    await type('Birth year', '19900');
    expect(updates()).toBe(2);
    expect(store.getState().profile.draft?.birth_year).toBeNull();
  });

  it('step 2 Weight: typed weights, weigh-in habit and the plain maths', async () => {
    const { store } = await seededStore(profileRow(NEW_USER));
    store.dispatch({
      type: 'profile/draftStarted',
      payload: {
        ...EXAMPLE,
        ...NEW_USER,
        birth_year: 1990,
        height_cm: 160,
        targetsSuggested: false,
      },
    });
    await renderWithStore(store, <OnboardingScreen step={2} />);
    expect(screen.getByPlaceholderText('e.g. 91')).toBeOnTheScreen();
    expect(screen.getByPlaceholderText('e.g. 75')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
    await type('Current weight (kg)', '68,5');
    await type('Goal weight (kg)', '60');
    await fireEvent.press(screen.getByRole('radio', { name: 'Once a week' }));
    expect(store.getState().profile.draft).toMatchObject({
      current_weight_kg: 68.5,
      goal_weight_kg: 60,
      weigh_in_mode: 'weekly',
    });
    expect(screen.getByText(/17 weeks/)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled();
  });

  it('step 3 Day: picking a row and a time; invalid times block Continue', async () => {
    const { store } = await seededStore();
    await renderWithStore(store, <OnboardingScreen step={3} />);
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

  it('step 3 without body answers (restart mid-way) goes back to step 1', async () => {
    const { store } = await seededStore(profileRow(NEW_USER));
    await renderWithStore(store, <OnboardingScreen step={3} />);
    expect(mockRouter.replace).toHaveBeenCalledWith({
      pathname: '/onboarding/[step]',
      params: { step: '1' },
    });
  });

  it('step 4 Targets: suggested once from the answers; banner, steps and budget', async () => {
    const { store } = await seededStore(profileRow(NEW_USER));
    store.dispatch({
      type: 'profile/draftStarted',
      payload: { ...EXAMPLE, kcal_target: 2500, targetsSuggested: false },
    });
    await renderWithStore(store, <OnboardingScreen step={4} />);
    // The example person gets the example targets back.
    expect(store.getState().profile.draft).toMatchObject({
      kcal_target: 2000,
      protein_target_g: 150,
      water_target_ml: 3000,
      targetsSuggested: true,
    });
    expect(screen.getByText('Est. maintenance ~2,550 kcal')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Increase Steps a day' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Decrease Monthly budget' }));
    expect(store.getState().profile.draft).toMatchObject({
      steps_min: 6500,
      monthly_budget_inr: 17000,
    });
    expect(screen.getByText(/^Example plan: 3,000 ml water/)).toBeOnTheScreen();
  });

  it('step 5 "Not now" (AC2): saves every answer and fits the routine to the day', async () => {
    const { store, today } = await seededStore(profileRow(NEW_USER));
    store.dispatch({
      type: 'profile/draftStarted',
      payload: {
        ...EXAMPLE,
        sex: 'female',
        birth_year: 1990,
        height_cm: 160,
        current_weight_kg: 68.5,
        goal_weight_kg: 60,
        wake_time: '07:00',
        phone_off_time: '23:00',
        sleep_time: '23:30',
        targetsSuggested: true,
      },
    });
    await renderWithStore(store, <OnboardingScreen step={5} />);
    expect(screen.getByText('Your starting plan')).toBeOnTheScreen();
    expect(
      screen.getByLabelText(/^Template: (Workday \(Mon–Fri\)|Weekend \(Sat–Sun\))$/),
    ).toBeOnTheScreen();
    await act(async () => {
      await fireEvent.press(screen.getByRole('button', { name: 'Skip notifications and finish' }));
    });
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
    const writes = queued(store);
    const profile = writes.find((w) => w.table === 'profile');
    expect(profile?.client_id).toBe('profile-c');
    expect(profile?.row).toMatchObject({
      sex: 'female',
      birth_year: 1990,
      height_cm: 160,
      goal_weight_kg: 60,
      start_weight_kg: 68.5,
      wake_time: '07:00',
    });
    expect(typeof profile?.row.onboarded_at).toBe('string');
    expect(writes.find((w) => w.table === 'weight_log')?.row).toEqual({
      date: today,
      weight_kg: 68.5,
    });
    expect(writes.find((w) => w.table === 'day_log')?.row).toMatchObject({ date: today });
    expect(writes.find((w) => w.table === 'workout_program')?.client_id).toBe('prog-c');
    const blocks = Object.fromEntries(
      writes.filter((w) => w.table === 'routine_block').map((w) => [w.client_id, w.row.start_time]),
    );
    // Wake moves to 07:00; the 05:10 water block keeps its place (10 min into the day).
    expect(blocks).toEqual({
      'wd-wake-c': '07:00',
      'wd-water-c': '07:10',
      'we-wake-c': '07:00',
      'rd-wake-c': '07:00',
    });
    expect(store.getState().profile.draft).toBeNull();
    // Saved setup: no new blank draft from the hidden step screens, and no racing
    // navigation (the root's guard moves on to the tour once onboarded_at is saved).
    await act(async () => {});
    expect(store.getState().profile.draft).toBeNull();
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it('finishing with earlier steps still mounted underneath (iPhone stack): no restart, no bounce to step 1', async () => {
    const { store } = await seededStore(profileRow(NEW_USER));
    store.dispatch({
      type: 'profile/draftStarted',
      payload: {
        ...EXAMPLE,
        sex: 'female',
        birth_year: 1990,
        height_cm: 160,
        current_weight_kg: 68.5,
        goal_weight_kg: 60,
        targetsSuggested: true,
      },
    });
    const starts = jest.spyOn(store, 'dispatch');
    await renderWithStore(
      store,
      <>
        <OnboardingScreen step={3} />
        <OnboardingScreen step={5} />
      </>,
    );
    await act(async () => {
      await fireEvent.press(screen.getByRole('button', { name: 'Skip notifications and finish' }));
    });
    await act(async () => {});
    expect(
      starts.mock.calls.filter(([a]) => (a as { type?: string }).type === 'profile/draftStarted'),
    ).toHaveLength(0);
    expect(store.getState().profile.draft).toBeNull();
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it('step 5 "Allow notifications" asks the OS first', async () => {
    const { store } = await seededStore();
    await renderWithStore(store, <OnboardingScreen step={5} />);
    await act(async () => {
      await fireEvent.press(screen.getByRole('button', { name: 'Allow notifications and finish' }));
    });
    expect(Notifications.requestPermissionsAsync).toHaveBeenCalled();
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });
});
