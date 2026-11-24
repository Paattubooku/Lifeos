import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';

import { authRedirectUrl } from '@/lib/authRedirect';
import type { AsyncKeyValue } from '@/lib/secureStorage';
import type { LifeosClient } from '@/lib/supabase';

import { type AuthLink } from './lib/authLink';
import {
  type AuthUser,
  authErrorMessage,
  isNetworkError,
  readStoredUser,
  userFromSession,
} from './lib/session';

export type AuthStatus = 'restoring' | 'signedOut' | 'signedIn';
export type SeedStatus = 'idle' | 'running' | 'done' | 'failed';

export type AuthState = {
  status: AuthStatus;
  user: AuthUser | null;
  /** Signed in from the stored session while the server was unreachable. */
  offline: boolean;
  pending: boolean;
  error: string | null;
  /** F25: non-error message, e.g. "confirm your email" after sign-up. */
  notice: string | null;
  /** Opened from a password-reset link: ask for a new password first. */
  recovery: boolean;
  /** seed_defaults() result for this session (retried on next launch when it fails). */
  seed: SeedStatus;
  /** .env missing or still holding the placeholders. */
  configMissing: boolean;
};

export const initialAuthState: AuthState = {
  status: 'restoring',
  user: null,
  offline: false,
  pending: false,
  error: null,
  notice: null,
  recovery: false,
  seed: 'idle',
  configMissing: false,
};

/** Injected through the thunk extra argument so tests can pass a fake client. */
export type AuthDeps = {
  getSupabase: () => LifeosClient;
  isConfigured: boolean;
  authStorage?: AsyncKeyValue;
  storageKey: string;
  /** Clock for the sync queue (tests pass a fake one). Defaults to Date.now. */
  now?: () => number;
};

type ThunkConfig = { extra: AuthDeps; rejectValue: string };

export const restoreSession = createAsyncThunk<
  { user: AuthUser | null; offline: boolean; configMissing: boolean },
  void,
  ThunkConfig
>('auth/restore', async (_, { extra }) => {
  if (!extra.isConfigured) return { user: null, offline: false, configMissing: true };
  const { data, error } = await extra.getSupabase().auth.getSession();
  const user = userFromSession(data.session);
  if (user) return { user, offline: false, configMissing: false };
  if (error && isNetworkError(error) && extra.authStorage) {
    const stored = readStoredUser(await extra.authStorage.getItem(extra.storageKey));
    if (stored) return { user: stored, offline: true, configMissing: false };
  }
  return { user: null, offline: false, configMissing: false };
});

/** Creates the PRD §6 defaults for this user. Idempotent server-side. */
export const ensureSeeded = createAsyncThunk<void, void, ThunkConfig>(
  'auth/ensureSeeded',
  async (_, { extra, rejectWithValue }) => {
    const { error } = await extra.getSupabase().rpc('seed_defaults');
    if (error) return rejectWithValue(authErrorMessage(error));
  },
);

export const signIn = createAsyncThunk<AuthUser, { email: string; password: string }, ThunkConfig>(
  'auth/signIn',
  async ({ email, password }, { extra, dispatch, rejectWithValue }) => {
    try {
      const { data, error } = await extra
        .getSupabase()
        .auth.signInWithPassword({ email: email.trim(), password });
      if (error) return rejectWithValue(authErrorMessage(error));
      const user = userFromSession(data.session);
      if (!user) return rejectWithValue('Sign-in did not return a session. Try again.');
      void dispatch(ensureSeeded());
      return user;
    } catch (e) {
      return rejectWithValue(authErrorMessage(e));
    }
  },
);

/**
 * F25: anyone can create an account. With email confirmation on (the Supabase
 * default) no session comes back: resolves null and the screen says to confirm.
 */
export const signUp = createAsyncThunk<
  AuthUser | null,
  { email: string; password: string },
  ThunkConfig
>('auth/signUp', async ({ email, password }, { extra, dispatch, rejectWithValue }) => {
  try {
    const { data, error } = await extra.getSupabase().auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: authRedirectUrl() },
    });
    if (error) return rejectWithValue(authErrorMessage(error));
    const user = userFromSession(data.session);
    if (!user) return null;
    void dispatch(ensureSeeded());
    return user;
  } catch (e) {
    return rejectWithValue(authErrorMessage(e));
  }
});

export const sendPasswordReset = createAsyncThunk<string, { email: string }, ThunkConfig>(
  'auth/sendPasswordReset',
  async ({ email }, { extra, rejectWithValue }) => {
    try {
      const { error } = await extra
        .getSupabase()
        .auth.resetPasswordForEmail(email.trim(), { redirectTo: authRedirectUrl() });
      if (error) return rejectWithValue(authErrorMessage(error));
      return email.trim();
    } catch (e) {
      return rejectWithValue(authErrorMessage(e));
    }
  },
);

/**
 * An email link opened the app: start the session it carries. The auth
 * listener then signs in (and seeds) as for any other session.
 */
export const completeAuthLink = createAsyncThunk<{ recovery: boolean }, AuthLink, ThunkConfig>(
  'auth/completeAuthLink',
  async (link, { extra, rejectWithValue }) => {
    if (link.kind === 'error') return rejectWithValue(link.message);
    try {
      const auth = extra.getSupabase().auth;
      const { error } =
        link.kind === 'session'
          ? await auth.setSession({
              access_token: link.accessToken,
              refresh_token: link.refreshToken,
            })
          : await auth.exchangeCodeForSession(link.code);
      if (error) return rejectWithValue('That link has expired. Sign in, or ask for a new one.');
      return { recovery: link.recovery };
    } catch (e) {
      return rejectWithValue(authErrorMessage(e));
    }
  },
);

/** After a reset link: save the new password. */
export const setNewPassword = createAsyncThunk<void, { password: string }, ThunkConfig>(
  'auth/setNewPassword',
  async ({ password }, { extra, rejectWithValue }) => {
    try {
      const { error } = await extra.getSupabase().auth.updateUser({ password });
      if (error) return rejectWithValue(authErrorMessage(error));
    } catch (e) {
      return rejectWithValue(authErrorMessage(e));
    }
  },
);

/**
 * F25: permanently deletes this account and all its data on the server
 * (Edge Function `delete-account`), then signs out of this phone.
 */
export const deleteAccount = createAsyncThunk<
  string,
  void,
  ThunkConfig & { state: { auth: AuthState } }
>('auth/deleteAccount', async (_, { extra, dispatch, getState, rejectWithValue }) => {
  const id = getState().auth.user?.id;
  if (!id) return rejectWithValue('Sign in first.');
  try {
    const { error } = await extra
      .getSupabase()
      .functions.invoke('delete-account', { body: { confirm: 'DELETE' } });
    if (error) return rejectWithValue('Could not delete the account. Check your connection.');
  } catch {
    return rejectWithValue('Could not delete the account. Check your connection.');
  }
  await dispatch(signOut());
  return id;
});

export const signOut = createAsyncThunk<void, void, ThunkConfig>(
  'auth/signOut',
  async (_, { extra }) => {
    // Local scope: forget this device's session even when offline.
    await extra.getSupabase().auth.signOut({ scope: 'local' });
  },
);

export const authSlice = createSlice({
  name: 'auth',
  initialState: initialAuthState,
  reducers: {
    /** From supabase.auth.onAuthStateChange (token refresh, sign-out elsewhere). */
    sessionChanged(state, action: PayloadAction<AuthUser | null>) {
      if (action.payload) {
        state.status = 'signedIn';
        state.user = action.payload;
        state.offline = false;
      } else {
        Object.assign(state, {
          ...initialAuthState,
          status: 'signedOut',
          configMissing: state.configMissing,
        });
      }
    },
    clearAuthError(state) {
      state.error = null;
      state.notice = null;
    },
  },
  extraReducers: (b) => {
    b.addCase(restoreSession.fulfilled, (state, { payload }) => {
      state.status = payload.user ? 'signedIn' : 'signedOut';
      state.user = payload.user;
      state.offline = payload.offline;
      state.configMissing = payload.configMissing;
    });
    b.addCase(restoreSession.rejected, (state) => {
      state.status = 'signedOut';
      state.user = null;
    });

    for (const thunk of [signIn, signUp] as const) {
      b.addCase(thunk.pending, (state) => {
        state.pending = true;
        state.error = null;
        state.notice = null;
      });
      b.addCase(thunk.fulfilled, (state, { payload, meta }) => {
        state.pending = false;
        if (!payload) {
          state.notice = `Account created. Open the link we sent to ${meta.arg.email.trim()}, then sign in.`;
          return;
        }
        state.status = 'signedIn';
        state.user = payload;
        state.offline = false;
      });
      b.addCase(thunk.rejected, (state, { payload, error }) => {
        state.pending = false;
        state.error = payload ?? error.message ?? 'Something went wrong. Try again.';
      });
    }

    b.addCase(sendPasswordReset.pending, (state) => {
      state.pending = true;
      state.error = null;
    });
    b.addCase(sendPasswordReset.fulfilled, (state) => {
      state.pending = false;
    });
    b.addCase(sendPasswordReset.rejected, (state, { payload, error }) => {
      state.pending = false;
      state.error = payload ?? error.message ?? 'Something went wrong. Try again.';
    });

    b.addCase(completeAuthLink.pending, (state) => {
      state.error = null;
      state.notice = null;
    });
    b.addCase(completeAuthLink.fulfilled, (state, { payload }) => {
      state.recovery = payload.recovery;
    });
    b.addCase(completeAuthLink.rejected, (state, { payload, error }) => {
      state.error = payload ?? error.message ?? 'Something went wrong. Try again.';
    });
    b.addCase(setNewPassword.pending, (state) => {
      state.pending = true;
      state.error = null;
    });
    b.addCase(setNewPassword.fulfilled, (state) => {
      state.pending = false;
      state.recovery = false;
      state.notice = 'Password changed.';
    });
    b.addCase(setNewPassword.rejected, (state, { payload, error }) => {
      state.pending = false;
      state.error = payload ?? error.message ?? 'Something went wrong. Try again.';
    });

    b.addCase(deleteAccount.pending, (state) => {
      state.pending = true;
      state.error = null;
    });
    b.addCase(deleteAccount.rejected, (state, { payload, error }) => {
      state.pending = false;
      state.error = payload ?? error.message ?? 'Something went wrong. Try again.';
    });

    b.addCase(ensureSeeded.pending, (state) => {
      state.seed = 'running';
    });
    b.addCase(ensureSeeded.fulfilled, (state) => {
      state.seed = 'done';
    });
    b.addCase(ensureSeeded.rejected, (state) => {
      state.seed = 'failed';
    });

    // Sign-out always ends signed out locally, even if the server call failed.
    b.addCase(signOut.fulfilled, (state) => {
      Object.assign(state, {
        ...initialAuthState,
        status: 'signedOut',
        configMissing: state.configMissing,
      });
    });
    b.addCase(signOut.rejected, (state) => {
      Object.assign(state, {
        ...initialAuthState,
        status: 'signedOut',
        configMissing: state.configMissing,
      });
    });
  },
});

export const { sessionChanged, clearAuthError } = authSlice.actions;
