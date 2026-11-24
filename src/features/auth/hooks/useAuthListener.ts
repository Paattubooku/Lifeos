import * as Linking from 'expo-linking';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { useAppDispatch, useAppSelector } from '@/store';

import { parseAuthLink } from '../lib/authLink';
import { userFromSession } from '../lib/session';
import { completeAuthLink, ensureSeeded, restoreSession, sessionChanged } from '../slice';

/**
 * Restores the session at launch, mirrors Supabase auth events into Redux, and
 * retries the default-data seed when the app returns to the foreground after a
 * failed (e.g. offline) attempt.
 */
export function useAuthListener() {
  const dispatch = useAppDispatch();
  const status = useAppSelector((s) => s.auth.status);
  const seed = useAppSelector((s) => s.auth.seed);
  const offline = useAppSelector((s) => s.auth.offline);

  useEffect(() => {
    void dispatch(restoreSession());
    if (!isSupabaseConfigured) return;
    const { data } = getSupabase().auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') return; // handled by restoreSession
      if (event === 'SIGNED_OUT') dispatch(sessionChanged(null));
      else {
        const user = userFromSession(session);
        if (user) dispatch(sessionChanged(user));
      }
    });
    return () => data.subscription.unsubscribe();
  }, [dispatch]);

  // Seed after a restored session (first launch after sign-in on another build, or a failed attempt).
  useEffect(() => {
    if (status === 'signedIn' && !offline && (seed === 'idle' || seed === 'failed')) {
      void dispatch(ensureSeeded());
    }
  }, [dispatch, status, seed, offline]);

  // Email links (confirm sign-up, reset password) opening the app: cold start and while open.
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const handle = (url: string | null) => {
      const link = parseAuthLink(url);
      if (link) void dispatch(completeAuthLink(link));
    };
    void Linking.getInitialURL().then(handle);
    const sub = Linking.addEventListener('url', ({ url }) => handle(url));
    return () => sub.remove();
  }, [dispatch]);

  // Back online after an offline launch: try to restore (refresh the token) again.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && offline) void dispatch(restoreSession());
    });
    return () => sub.remove();
  }, [dispatch, offline]);
}
