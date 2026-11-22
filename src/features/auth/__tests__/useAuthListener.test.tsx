import { act, renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { AppState } from 'react-native';
import { Provider } from 'react-redux';

import { fakeSupabase, memoryStorage, SESSION, storeWithFake } from '@/test/fakeSupabase';

type Listener = (event: string, session: unknown) => void;

const mockFake = fakeSupabase();
let authListener: Listener = () => undefined;
const unsubscribe = jest.fn();
(mockFake.client.auth as unknown as { onAuthStateChange: jest.Mock }).onAuthStateChange = jest.fn(
  (fn: Listener) => {
    authListener = fn;
    return { data: { subscription: { unsubscribe } } };
  },
);

jest.mock('@/lib/supabase', () => ({
  getSupabase: () => mockFake.client,
  isSupabaseConfigured: true,
  authStorage: undefined,
  AUTH_STORAGE_KEY: 'lifeos-auth',
}));

// eslint-disable-next-line import/first
import { useAuthListener } from '../hooks/useAuthListener';

function setup(overrides = {}) {
  const ctx = storeWithFake(mockFake, overrides);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <Provider store={ctx.store}>{children}</Provider>
  );
  return { ...ctx, wrapper };
}

describe('useAuthListener', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFake.auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
  });

  it('restores at launch and seeds a restored session', async () => {
    mockFake.auth.getSession.mockResolvedValue({ data: { session: SESSION }, error: null });
    const { store, wrapper } = setup();
    await renderHook(() => useAuthListener(), { wrapper });
    await act(async () => undefined);
    expect(store.getState().auth.status).toBe('signedIn');
    expect(mockFake.rpc).toHaveBeenCalledWith('seed_defaults');
  });

  it('mirrors Supabase sign-in, refresh and sign-out events', async () => {
    const { store, wrapper } = setup();
    const { unmount } = await renderHook(() => useAuthListener(), { wrapper });
    await act(async () => undefined);
    expect(store.getState().auth.status).toBe('signedOut');

    await act(async () => authListener('INITIAL_SESSION', SESSION));
    expect(store.getState().auth.status).toBe('signedOut');

    await act(async () => authListener('TOKEN_REFRESHED', SESSION));
    expect(store.getState().auth.status).toBe('signedIn');

    await act(async () => authListener('USER_UPDATED', null));
    expect(store.getState().auth.status).toBe('signedIn');

    await act(async () => authListener('SIGNED_OUT', null));
    expect(store.getState().auth.status).toBe('signedOut');

    await unmount();
    expect(unsubscribe).toHaveBeenCalled();
  });

  it('retries the restore when the app comes back online after an offline launch', async () => {
    const appStateListeners: ((s: string) => void)[] = [];
    const spy = jest.spyOn(AppState, 'addEventListener').mockImplementation((_t, fn) => {
      appStateListeners.push(fn as (s: string) => void);
      return { remove: jest.fn() } as unknown as ReturnType<typeof AppState.addEventListener>;
    });
    mockFake.auth.getSession.mockResolvedValueOnce({
      data: { session: null },
      error: { name: 'AuthRetryableFetchError', status: 0 },
    });
    const { store, wrapper } = setup({
      authStorage: memoryStorage({ 'lifeos-auth': JSON.stringify(SESSION) }),
    });
    await renderHook(() => useAuthListener(), { wrapper });
    await act(async () => undefined);
    expect(store.getState().auth.offline).toBe(true);
    expect(mockFake.rpc).not.toHaveBeenCalled(); // no seeding while offline

    mockFake.auth.getSession.mockResolvedValueOnce({ data: { session: SESSION }, error: null });
    await act(async () => appStateListeners.forEach((l) => l('active')));
    expect(store.getState().auth.offline).toBe(false);
    spy.mockRestore();
  });
});
