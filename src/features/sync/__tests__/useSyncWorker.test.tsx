import NetInfo from '@react-native-community/netinfo';
import { act, renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { AppState } from 'react-native';
import { Provider } from 'react-redux';

import { sessionChanged } from '@/features/auth/slice';
import { makeStore } from '@/store';
import { SESSION } from '@/test/fakeSupabase';
import { fakeSyncServer } from '@/test/fakeSyncServer';

import { isOnline, SYNC_INTERVAL_MS, useSyncWorker } from '../hooks/useSyncWorker';
import { connectivityChanged, queueUpsert } from '../slice';

type NetListener = (s: {
  isConnected: boolean | null;
  isInternetReachable: boolean | null;
}) => void;

function setup() {
  const server = fakeSyncServer();
  const store = makeStore({
    getSupabase: () => server.client,
    isConfigured: true,
    storageKey: 'lifeos-auth',
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  );
  return { server, store, wrapper };
}

describe('isOnline', () => {
  it('is online unless NetInfo is sure it is not', () => {
    expect(isOnline({ isConnected: true, isInternetReachable: true })).toBe(true);
    expect(isOnline({ isConnected: true, isInternetReachable: null })).toBe(true);
    expect(isOnline({ isConnected: false, isInternetReachable: null })).toBe(false);
    expect(isOnline({ isConnected: true, isInternetReachable: false })).toBe(false);
  });
});

describe('useSyncWorker', () => {
  let netListener: NetListener = () => undefined;
  let appListener: (s: string) => void = () => undefined;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.mocked(NetInfo.addEventListener).mockImplementation((fn) => {
      netListener = fn as unknown as NetListener;
      return jest.fn();
    });
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_t, fn) => {
      appListener = fn as (s: string) => void;
      return { remove: jest.fn() } as unknown as ReturnType<typeof AppState.addEventListener>;
    });
    Object.defineProperty(AppState, 'currentState', { value: 'active', configurable: true });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('pushes on reconnect, on foreground and every 60 s', async () => {
    const { server, store, wrapper } = setup();
    store.dispatch(connectivityChanged({ online: false, now: Date.now() }));
    store.dispatch(sessionChanged({ id: SESSION.user.id, email: SESSION.user.email }));
    const { unmount } = await renderHook(() => useSyncWorker(), { wrapper });

    // Offline write: nothing pushed.
    await act(async () => {
      await store.dispatch(
        queueUpsert({ table: 'water_log', row: { date: '2026-11-23', amount_ml: 200 } }),
      );
    });
    expect(server.calls).toBe(0);

    // Reconnect → pushed.
    await act(async () => netListener({ isConnected: true, isInternetReachable: true }));
    expect(store.getState().sync.online).toBe(true);
    expect(server.rows('water_log')).toHaveLength(1);

    // Heartbeat: a write that failed once gets retried by the 60 s interval.
    server.failNext({ kind: 'error', error: { status: 503, message: 'busy' } });
    await act(async () => {
      await store.dispatch(
        queueUpsert({ table: 'water_log', row: { date: '2026-11-23', amount_ml: 500 } }),
      );
    });
    expect(store.getState().sync.queue).toHaveLength(1);
    await act(async () => {
      jest.advanceTimersByTime(SYNC_INTERVAL_MS);
    });
    expect(store.getState().sync.queue).toHaveLength(0);

    // Background stops the heartbeat; foreground runs at once.
    await act(async () => appListener('background'));
    await act(async () => appListener('active'));
    await act(async () => netListener({ isConnected: false, isInternetReachable: false }));
    expect(store.getState().sync.online).toBe(false);
    await unmount();
  });

  it('does nothing while signed out', async () => {
    const { server, store, wrapper } = setup();
    await renderHook(() => useSyncWorker(), { wrapper });
    await act(async () => netListener({ isConnected: true, isInternetReachable: true }));
    expect(store.getState().sync.online).toBe(true);
    expect(server.calls).toBe(0);
  });
});
