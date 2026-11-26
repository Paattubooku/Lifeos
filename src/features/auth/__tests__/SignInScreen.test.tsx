import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Provider } from 'react-redux';

import { fakeSupabase, storeWithFake } from '@/test/fakeSupabase';
import { SnackbarProvider, ThemeProvider } from '@/ui';

import { SignInScreen } from '../components/SignInScreen';
import { restoreSession } from '../slice';

const mockRouter = { push: jest.fn(), back: jest.fn(), replace: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));

function setup(ui: ReactElement, fake = fakeSupabase(), configured = true) {
  const ctx = storeWithFake(fake, { isConfigured: configured });
  const view = render(
    <Provider store={ctx.store}>
      <GestureHandlerRootView>
        <ThemeProvider>
          <SnackbarProvider>{ui}</SnackbarProvider>
        </ThemeProvider>
      </GestureHandlerRootView>
    </Provider>,
  );
  return { ...ctx, view };
}

describe('SignInScreen', () => {
  it('shows sign-in with a way to create an account (F25)', async () => {
    const { view } = setup(<SignInScreen />);
    await view;
    expect(screen.getByRole('header', { name: 'LifeOS' })).toBeOnTheScreen();
    expect(screen.getByText('Your whole day. One screen.')).toBeOnTheScreen();
    expect(screen.getByText('Your data syncs to your account only.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'New here? Create an account' })).toBeOnTheScreen();
    expect(screen.queryByLabelText('Confirm password')).toBeNull();
  });

  it('signs in with email and password', async () => {
    const { view, store, auth } = setup(<SignInScreen />);
    await view;
    await fireEvent.changeText(screen.getByLabelText('Email'), 'ptr@example.com');
    await fireEvent.changeText(screen.getByLabelText('Password'), 'secret-pass');
    await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
    expect(auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'ptr@example.com',
      password: 'secret-pass',
    });
    expect(store.getState().auth.status).toBe('signedIn');
  });

  it('validates before calling Supabase', async () => {
    const { view, auth } = setup(<SignInScreen />);
    await view;
    await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
    expect(screen.getByText('Enter your email address.')).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText('Email'), 'ptr@example.com');
    await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
    expect(screen.getByText('Enter your password.')).toBeOnTheScreen();
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it('shows the server error', async () => {
    const fake = fakeSupabase();
    fake.auth.signInWithPassword.mockResolvedValueOnce({
      data: { session: null },
      error: { code: 'invalid_credentials', status: 400 },
    });
    const { view } = setup(<SignInScreen />, fake);
    await view;
    await fireEvent.changeText(screen.getByLabelText('Email'), 'ptr@example.com');
    await fireEvent.changeText(screen.getByLabelText('Password'), 'wrong');
    await fireEvent(screen.getByLabelText('Password'), 'submitEditing');
    expect(screen.getByText('Email or password is wrong.')).toBeOnTheScreen();
  });

  it('sends a password reset and confirms with a snackbar', async () => {
    jest.useFakeTimers();
    const { view, auth } = setup(<SignInScreen />);
    await view;
    await fireEvent.press(screen.getByRole('button', { name: 'Forgot password' }));
    expect(screen.getByText('Enter your email address.')).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText('Email'), 'ptr@example.com');
    await fireEvent.press(screen.getByRole('button', { name: 'Forgot password' }));
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith('ptr@example.com', {
      redirectTo: 'lifeos://auth-callback',
    });
    expect(screen.getByText('Reset link sent to ptr@example.com')).toBeOnTheScreen();
    await act(async () => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it('creates an account: length rule, matching passwords, then confirm-email notice', async () => {
    const fake = fakeSupabase();
    fake.auth.signUp.mockResolvedValueOnce({ data: { session: null }, error: null });
    const { view, auth } = setup(<SignInScreen />, fake);
    await view;
    await fireEvent.press(screen.getByRole('button', { name: 'New here? Create an account' }));
    expect(screen.getByText('Create your account. Setup takes 2 minutes.')).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText('Email'), 'new@example.com');
    await fireEvent.changeText(screen.getByLabelText('Password'), 'short');
    await fireEvent.press(screen.getByRole('button', { name: 'Create account' }));
    expect(screen.getByText('Use at least 8 characters.')).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText('Password'), 'long-enough');
    await fireEvent.changeText(screen.getByLabelText('Confirm password'), 'long-enoug');
    await fireEvent.press(screen.getByRole('button', { name: 'Create account' }));
    expect(screen.getByText('The two passwords don’t match.')).toBeOnTheScreen();
    expect(auth.signUp).not.toHaveBeenCalled();
    await fireEvent.changeText(screen.getByLabelText('Confirm password'), 'long-enough');
    await act(async () => {
      await fireEvent.press(screen.getByRole('button', { name: 'Create account' }));
    });
    expect(auth.signUp).toHaveBeenCalledWith({
      email: 'new@example.com',
      password: 'long-enough',
      options: { emailRedirectTo: 'lifeos://auth-callback' },
    });
    expect(
      screen.getByText('Account created. Open the link we sent to new@example.com, then sign in.'),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Have an account? Sign in' }));
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeOnTheScreen();
    expect(screen.queryByTestId('auth-notice')).toBeNull();
  });

  it('explains missing configuration and disables sign-in', async () => {
    const { view, store } = setup(<SignInScreen />, fakeSupabase(), false);
    await view;
    await act(async () => {
      await store.dispatch(restoreSession());
    });
    expect(screen.getByText('Supabase isn’t set up yet.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeDisabled();
  });

  it('moves focus from email to password on "next"', async () => {
    const { view } = setup(<SignInScreen />);
    await view;
    await fireEvent(screen.getByLabelText('Email'), 'submitEditing');
    expect(screen.getByLabelText('Password')).toBeOnTheScreen();
  });
});
