import { render } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Provider } from 'react-redux';

import { sessionChanged } from '@/features/auth/slice';
import { profileApi } from '@/features/profile/api';
import { connectivityChanged } from '@/features/sync/slice';
import { todayLogical } from '@/lib/dates';
import { makeStore } from '@/store';
import type { Tables } from '@/types/supabase';
import { SnackbarProvider, ThemeProvider } from '@/ui';

import { fakeSupabase, SESSION } from './fakeSupabase';

export const base = {
  user_id: SESSION.user.id,
  created_at: '2026-11-23T00:00:00Z',
  updated_at: '2026-11-23T00:00:00Z',
  deleted_at: null,
};

export function profileRow(over: Partial<Tables<'profile'>> = {}): Tables<'profile'> {
  return {
    ...base,
    id: 'profile-id',
    client_id: 'profile-c',
    height_cm: 170,
    start_weight_kg: 91,
    goal_weight_kg: 75,
    water_target_ml: 3000,
    kcal_target: 2200,
    protein_target_g: 150,
    wake_time: '05:00:00',
    sleep_time: '22:00:00',
    phone_off_time: '21:30:00',
    sex: 'male',
    birth_year: 1997,
    steps_min: 6000,
    activity_factor: 1.4,
    monthly_budget_inr: 18000,
    water_reminder_interval_min: 90,
    weigh_in_mode: 'daily',
    weigh_in_weekday: 1,
    coffee_limit: 2,
    theme: 'dark',
    onboarded_at: null,
    tour_seen_at: null,
    ...over,
  };
}

const template = (id: string, name: string, weekdays: number[], isDefault = false) => ({
  ...base,
  id,
  client_id: `${id}-c`,
  name,
  weekdays,
  is_default: isDefault,
  sort: 0,
  archived_at: null,
});

const block = (id: string, templateId: string, kind: string, start: string) => ({
  ...base,
  id,
  client_id: `${id}-c`,
  template_id: templateId,
  title: kind,
  kind,
  start_time: start,
  duration_min: 10,
  ref_slot: null,
  auto_complete: false,
  is_optional: false,
  notify: true,
  sort: 0,
});

export const ROUTINE = {
  templates: [
    template('tpl-workday', 'Workday', [1, 2, 3, 4, 5], true),
    template('tpl-weekend', 'Weekend', [6, 7]),
    template('tpl-rest', 'Rest day', []),
  ],
  blocks: [
    block('wd-wake', 'tpl-workday', 'wake', '05:00:00'),
    block('wd-water', 'tpl-workday', 'water', '05:10:00'),
    block('we-wake', 'tpl-weekend', 'wake', '05:00:00'),
    block('rd-wake', 'tpl-rest', 'wake', '05:00:00'),
  ],
};

/** Signed-in store whose RTK Query cache already holds the seeded rows (online). */
export async function seededStore(profile = profileRow()) {
  const fake = fakeSupabase();
  const store = makeStore({ getSupabase: () => fake.client, isConfigured: true, storageKey: 'k' });
  store.dispatch(sessionChanged({ id: SESSION.user.id, email: SESSION.user.email }));
  store.dispatch(connectivityChanged({ online: false, now: Date.now() })); // keep writes queued
  const today = todayLogical();
  await store.dispatch(profileApi.util.upsertQueryData('getProfile', undefined, profile));
  await store.dispatch(profileApi.util.upsertQueryData('getRoutine', undefined, ROUTINE));
  await store.dispatch(profileApi.util.upsertQueryData('getDayLog', today, null));
  await store.dispatch(profileApi.util.upsertQueryData('getWeightOn', today, null));
  await store.dispatch(profileApi.util.upsertQueryData('getLatestWeight', undefined, null));
  await store.dispatch(
    profileApi.util.upsertQueryData('getActiveProgram', undefined, {
      ...base,
      id: 'prog',
      client_id: 'prog-c',
      name: 'Dumbbell Beginner 5-Day',
      is_active: true,
      start_date: '2026-01-05',
    }),
  );
  return { store, fake, today };
}

export function renderWithStore(store: ReturnType<typeof makeStore>, ui: ReactElement) {
  return render(
    <Provider store={store}>
      <GestureHandlerRootView>
        <ThemeProvider>
          <SnackbarProvider>{ui}</SnackbarProvider>
        </ThemeProvider>
      </GestureHandlerRootView>
    </Provider>,
  );
}
