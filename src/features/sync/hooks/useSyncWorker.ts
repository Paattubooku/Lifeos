import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { useAppDispatch, useAppSelector } from '@/store';

import { connectivityChanged, runSync } from '../slice';

export const SYNC_INTERVAL_MS = 60_000;

/** Online unless NetInfo is sure we're not (null = unknown → try). */
export function isOnline(
  state: Pick<NetInfoState, 'isConnected' | 'isInternetReachable'>,
): boolean {
  return state.isConnected !== false && state.isInternetReachable !== false;
}

/**
 * Runs the sync worker (PRD F02): at launch/sign-in, when the app comes to the
 * foreground, when the network comes back, and every 60 s while in the foreground.
 * Writes also trigger a push themselves (queueUpsert / queueSoftDelete).
 */
export function useSyncWorker() {
  const dispatch = useAppDispatch();
  const signedIn = useAppSelector((s) => s.auth.status === 'signedIn');

  // Network changes.
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const online = isOnline(state);
      dispatch(connectivityChanged({ online, now: Date.now() }));
      if (online) void dispatch(runSync());
    });
    return unsubscribe;
  }, [dispatch]);

  // Launch / sign-in, foreground, and the 60 s heartbeat.
  useEffect(() => {
    if (!signedIn) return;
    void dispatch(runSync());

    let timer: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (!timer) timer = setInterval(() => void dispatch(runSync()), SYNC_INTERVAL_MS);
    };
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };
    if (AppState.currentState === 'active') start();

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void dispatch(runSync());
        start();
      } else {
        stop();
      }
    });
    return () => {
      sub.remove();
      stop();
    };
  }, [dispatch, signedIn]);
}
