import { fakeSupabase, memoryStorage, SESSION, storeWithFake } from '@/test/fakeSupabase';

import {
  authSlice,
  ensureSeeded,
  initialAuthState,
  restoreSession,
  sendPasswordReset,
  sessionChanged,
  signIn,
  signOut,
  signUp,
} from '../slice';

const USER = { id: SESSION.user.id, email: SESSION.user.email };

describe('auth slice', () => {
  it('starts restoring', () => {
    expect(authSlice.reducer(undefined, { type: 'init' })).toEqual(initialAuthState);
  });

  describe('restoreSession (AC1: stays signed in across restarts)', () => {
    it('signs in from the stored Supabase session', async () => {
      const { store, auth } = storeWithFake();
      auth.getSession.mockResolvedValueOnce({ data: { session: SESSION }, error: null });
      await store.dispatch(restoreSession());
      expect(store.getState().auth).toMatchObject({
        status: 'signedIn',
        user: USER,
        offline: false,
      });
    });

    it('is signed out when there is no session', async () => {
      const { store } = storeWithFake();
      await store.dispatch(restoreSession());
      expect(store.getState().auth.status).toBe('signedOut');
    });

    it('opens normally offline with a stored session (edge case)', async () => {
      const fake = fakeSupabase();
      fake.auth.getSession.mockResolvedValueOnce({
        data: { session: null },
        error: { name: 'AuthRetryableFetchError', message: 'Network request failed', status: 0 },
      });
      const { store } = storeWithFake(fake, {
        authStorage: memoryStorage({ 'lifeos-auth': JSON.stringify(SESSION) }),
      });
      await store.dispatch(restoreSession());
      expect(store.getState().auth).toMatchObject({
        status: 'signedIn',
        user: USER,
        offline: true,
      });
    });

    it('stays signed out offline when nothing is stored', async () => {
      const fake = fakeSupabase();
      fake.auth.getSession.mockResolvedValueOnce({
        data: { session: null },
        error: { name: 'AuthRetryableFetchError', message: 'x', status: 0 },
      });
      const { store } = storeWithFake(fake);
      await store.dispatch(restoreSession());
      expect(store.getState().auth.status).toBe('signedOut');
    });

    it('treats a non-network error as signed out (e.g. revoked refresh token)', async () => {
      const fake = fakeSupabase();
      fake.auth.getSession.mockResolvedValueOnce({
        data: { session: null },
        error: { name: 'AuthApiError', status: 400, code: 'refresh_token_not_found' },
      });
      const { store } = storeWithFake(fake, {
        authStorage: memoryStorage({ 'lifeos-auth': JSON.stringify(SESSION) }),
      });
      await store.dispatch(restoreSession());
      expect(store.getState().auth.status).toBe('signedOut');
    });

    it('flags missing configuration without calling Supabase', async () => {
      const { store, auth } = storeWithFake(undefined, { isConfigured: false });
      await store.dispatch(restoreSession());
      expect(store.getState().auth).toMatchObject({ status: 'signedOut', configMissing: true });
      expect(auth.getSession).not.toHaveBeenCalled();
    });

    it('falls back to signed out if restoring throws', async () => {
      const fake = fakeSupabase();
      fake.auth.getSession.mockRejectedValueOnce(new Error('boom'));
      const { store } = storeWithFake(fake);
      await store.dispatch(restoreSession());
      expect(store.getState().auth.status).toBe('signedOut');
    });
  });

  describe('signIn', () => {
    it('signs in, trims the email and seeds the defaults', async () => {
      const { store, auth, rpc } = storeWithFake();
      await store.dispatch(signIn({ email: ' ptr@example.com ', password: 'secret' }));
      expect(auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'ptr@example.com',
        password: 'secret',
      });
      expect(store.getState().auth).toMatchObject({
        status: 'signedIn',
        user: USER,
        pending: false,
        error: null,
      });
      expect(rpc).toHaveBeenCalledWith('seed_defaults');
      await Promise.resolve();
      expect(store.getState().auth.seed).toBe('done');
    });

    it('shows a friendly error for wrong credentials', async () => {
      const fake = fakeSupabase();
      fake.auth.signInWithPassword.mockResolvedValueOnce({
        data: { session: null },
        error: {
          name: 'AuthApiError',
          status: 400,
          code: 'invalid_credentials',
          message: 'Invalid login credentials',
        },
      });
      const { store } = storeWithFake(fake);
      await store.dispatch(signIn({ email: 'ptr@example.com', password: 'nope' }));
      expect(store.getState().auth).toMatchObject({
        status: 'restoring',
        pending: false,
        error: 'Email or password is wrong.',
      });
    });

    it('handles a thrown network error', async () => {
      const fake = fakeSupabase();
      fake.auth.signInWithPassword.mockRejectedValueOnce(new TypeError('Network request failed'));
      const { store } = storeWithFake(fake);
      await store.dispatch(signIn({ email: 'ptr@example.com', password: 'x' }));
      expect(store.getState().auth.error).toBe('No connection. Try again when you’re online.');
    });

    it('rejects a response without a session', async () => {
      const fake = fakeSupabase();
      fake.auth.signInWithPassword.mockResolvedValueOnce({ data: { session: null }, error: null });
      const { store } = storeWithFake(fake);
      await store.dispatch(signIn({ email: 'ptr@example.com', password: 'x' }));
      expect(store.getState().auth.error).toBe('Sign-in did not return a session. Try again.');
    });
  });

  describe('signUp (dev flag only)', () => {
    it('creates the account and seeds', async () => {
      const { store, auth, rpc } = storeWithFake();
      await store.dispatch(signUp({ email: 'ptr@example.com', password: 'longpassword' }));
      expect(auth.signUp).toHaveBeenCalled();
      expect(store.getState().auth.status).toBe('signedIn');
      expect(rpc).toHaveBeenCalledWith('seed_defaults');
    });

    it('asks to confirm the email when no session comes back', async () => {
      const fake = fakeSupabase();
      fake.auth.signUp.mockResolvedValueOnce({ data: { session: null }, error: null });
      const { store } = storeWithFake(fake);
      await store.dispatch(signUp({ email: 'ptr@example.com', password: 'longpassword' }));
      expect(store.getState().auth.error).toBe('Account created. Confirm the email, then sign in.');
    });

    it('reports a disabled sign-up and thrown errors', async () => {
      const fake = fakeSupabase();
      fake.auth.signUp.mockResolvedValueOnce({
        data: { session: null },
        error: { code: 'signup_disabled' },
      });
      const { store } = storeWithFake(fake);
      await store.dispatch(signUp({ email: 'ptr@example.com', password: 'longpassword' }));
      expect(store.getState().auth.error).toBe('Sign-up is turned off for this project.');
      fake.auth.signUp.mockRejectedValueOnce(new Error('kaput'));
      await store.dispatch(signUp({ email: 'ptr@example.com', password: 'longpassword' }));
      expect(store.getState().auth.error).toBe('kaput');
    });
  });

  describe('ensureSeeded', () => {
    it('marks failure so it is retried later', async () => {
      const fake = fakeSupabase();
      fake.rpc.mockResolvedValueOnce({ data: {}, error: new TypeError('Network request failed') });
      const { store } = storeWithFake(fake);
      await store.dispatch(ensureSeeded());
      expect(store.getState().auth.seed).toBe('failed');
    });
  });

  describe('sendPasswordReset', () => {
    it('sends the reset email', async () => {
      const { store, auth } = storeWithFake();
      const res = await store.dispatch(sendPasswordReset({ email: ' ptr@example.com' }));
      expect(auth.resetPasswordForEmail).toHaveBeenCalledWith('ptr@example.com');
      expect(res.payload).toBe('ptr@example.com');
      expect(store.getState().auth.pending).toBe(false);
    });

    it('reports errors', async () => {
      const fake = fakeSupabase();
      fake.auth.resetPasswordForEmail.mockResolvedValueOnce({ data: {}, error: { status: 429 } });
      const { store } = storeWithFake(fake);
      await store.dispatch(sendPasswordReset({ email: 'ptr@example.com' }));
      expect(store.getState().auth.error).toBe('Too many attempts. Wait a minute and try again.');
      fake.auth.resetPasswordForEmail.mockRejectedValueOnce(new Error('down'));
      await store.dispatch(sendPasswordReset({ email: 'ptr@example.com' }));
      expect(store.getState().auth.error).toBe('down');
    });
  });

  describe('signOut and session events', () => {
    it('signs out locally, even if the server call fails', async () => {
      const fake = fakeSupabase();
      const { store } = storeWithFake(fake);
      store.dispatch(sessionChanged(USER));
      await store.dispatch(signOut());
      expect(fake.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
      expect(store.getState().auth).toMatchObject({ status: 'signedOut', user: null });

      store.dispatch(sessionChanged(USER));
      fake.auth.signOut.mockRejectedValueOnce(new Error('offline'));
      await store.dispatch(signOut());
      expect(store.getState().auth.status).toBe('signedOut');
    });

    it('follows Supabase auth events', () => {
      let state = authSlice.reducer(undefined, sessionChanged(USER));
      expect(state).toMatchObject({ status: 'signedIn', user: USER });
      state = authSlice.reducer(state, sessionChanged(null));
      expect(state).toMatchObject({ status: 'signedOut', user: null });
    });
  });
});
