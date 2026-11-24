import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Provider } from 'react-redux';

import { fakeSupabase, storeWithFake } from '@/test/fakeSupabase';
import { SnackbarProvider, ThemeProvider } from '@/ui';

import { SetPasswordScreen } from '../components/SetPasswordScreen';
import { parseAuthLink } from '../lib/authLink';
import { completeAuthLink, sendPasswordReset } from '../slice';

describe('parseAuthLink', () => {
  it('reads the session from the fragment (installed app and Expo Go URLs)', () => {
    expect(
      parseAuthLink('lifeos://auth-callback#access_token=a&refresh_token=r&type=signup'),
    ).toEqual({ kind: 'session', accessToken: 'a', refreshToken: 'r', recovery: false });
    expect(
      parseAuthLink(
        'exp://u.expo.dev/abc/--/auth-callback?x=1#access_token=a&refresh_token=r&type=recovery',
      ),
    ).toEqual({ kind: 'session', accessToken: 'a', refreshToken: 'r', recovery: true });
  });
  it('reads a PKCE code and errors; ignores other links', () => {
    expect(parseAuthLink('lifeos://auth-callback?code=c1')).toEqual({
      kind: 'code',
      code: 'c1',
      recovery: false,
    });
    expect(
      parseAuthLink(
        'lifeos://auth-callback#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired',
      ),
    ).toEqual({ kind: 'error', message: 'That link has expired. Sign in, or ask for a new one.' });
    expect(parseAuthLink('lifeos://auth-callback?error_description=Bad+thing')).toEqual({
      kind: 'error',
      message: 'Couldn’t sign you in: Bad thing',
    });
    expect(parseAuthLink('lifeos://auth-callback')).toBeNull();
    expect(parseAuthLink('lifeos://today?access_token=a&refresh_token=r')).toBeNull();
    expect(parseAuthLink(null)).toBeNull();
  });
});

describe('completeAuthLink', () => {
  it('starts the session from the link; a reset link asks for a new password', async () => {
    const { store, auth } = storeWithFake();
    await store.dispatch(
      completeAuthLink({ kind: 'session', accessToken: 'a', refreshToken: 'r', recovery: true }),
    );
    expect(auth.setSession).toHaveBeenCalledWith({ access_token: 'a', refresh_token: 'r' });
    expect(store.getState().auth.recovery).toBe(true);
    await store.dispatch(completeAuthLink({ kind: 'code', code: 'c', recovery: false }));
    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith('c');
    expect(store.getState().auth.recovery).toBe(false);
  });
  it('shows expired / error links on the sign-in screen', async () => {
    const fake = fakeSupabase();
    fake.auth.setSession.mockResolvedValueOnce({ data: {}, error: { message: 'bad' } });
    const { store } = storeWithFake(fake);
    await store.dispatch(
      completeAuthLink({ kind: 'session', accessToken: 'a', refreshToken: 'r', recovery: false }),
    );
    expect(store.getState().auth.error).toBe(
      'That link has expired. Sign in, or ask for a new one.',
    );
    await store.dispatch(completeAuthLink({ kind: 'error', message: 'Nope' }));
    expect(store.getState().auth.error).toBe('Nope');
    fake.auth.exchangeCodeForSession.mockRejectedValueOnce(new Error('kaput'));
    await store.dispatch(completeAuthLink({ kind: 'code', code: 'c', recovery: false }));
    expect(store.getState().auth.error).toBe('kaput');
  });
  it('reset emails link back to the app', async () => {
    const { store, auth } = storeWithFake();
    await store.dispatch(sendPasswordReset({ email: ' me@example.com ' }));
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith('me@example.com', {
      redirectTo: 'lifeos://auth-callback',
    });
  });
});

describe('SetPasswordScreen', () => {
  const setup = async (fake = fakeSupabase()) => {
    const ctx = storeWithFake(fake);
    await render(
      <Provider store={ctx.store}>
        <GestureHandlerRootView>
          <ThemeProvider>
            <SnackbarProvider>
              <SetPasswordScreen />
            </SnackbarProvider>
          </ThemeProvider>
        </GestureHandlerRootView>
      </Provider>,
    );
    return ctx;
  };

  it('checks length and match, then saves and leaves recovery', async () => {
    const { store, auth } = await setup();
    await act(async () => {
      await store.dispatch(
        completeAuthLink({ kind: 'session', accessToken: 'a', refreshToken: 'r', recovery: true }),
      );
    });
    await fireEvent.changeText(screen.getByLabelText('New password'), 'short');
    await fireEvent.press(screen.getByRole('button', { name: 'Save new password' }));
    expect(screen.getByText('Use at least 8 characters.')).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText('New password'), 'long-enough');
    await fireEvent.changeText(screen.getByLabelText('Confirm new password'), 'long-enougX');
    await fireEvent.press(screen.getByRole('button', { name: 'Save new password' }));
    expect(screen.getByText('The two passwords don’t match.')).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText('Confirm new password'), 'long-enough');
    await act(async () => {
      await fireEvent.press(screen.getByRole('button', { name: 'Save new password' }));
    });
    expect(auth.updateUser).toHaveBeenCalledWith({ password: 'long-enough' });
    expect(store.getState().auth.recovery).toBe(false);
    expect(store.getState().auth.notice).toBe('Password changed.');
  });

  it('shows a server error; cancel signs out', async () => {
    const fake = fakeSupabase();
    fake.auth.updateUser.mockResolvedValueOnce({ data: {}, error: { message: 'Too weak' } });
    const { auth } = await setup(fake);
    await fireEvent.changeText(screen.getByLabelText('New password'), 'long-enough');
    await fireEvent.changeText(screen.getByLabelText('Confirm new password'), 'long-enough');
    await act(async () => {
      await fireEvent.press(screen.getByRole('button', { name: 'Save new password' }));
    });
    expect(screen.getByText('Too weak')).toBeOnTheScreen();
    await act(async () => {
      await fireEvent.press(screen.getByRole('button', { name: 'Cancel and sign out' }));
    });
    expect(auth.signOut).toHaveBeenCalled();
  });
});
