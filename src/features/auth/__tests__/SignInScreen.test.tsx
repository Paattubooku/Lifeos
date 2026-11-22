import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Provider } from 'react-redux';

import { fakeSupabase, storeWithFake } from '@/test/fakeSupabase';
import { SnackbarProvider, ThemeProvider } from '@/ui';

import { SignInScreen } from '../components/SignInScreen';
import { restoreSession } from '../slice';

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
  it('matches the design copy and has no sign-up in production', async () => {
    const { view } = setup(<SignInScreen allowSignUp={false} />);
    await view;
    expect(screen.getByRole('header', { name: 'LifeOS' })).toBeOnTheScreen();
    expect(screen.getByText('5:00 am to 10:00 pm. One screen.')).toBeOnTheScreen();
    expect(screen.getByText('Single account. No sign-up, no sharing.')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: /Create account/ })).toBeNull();
  });

  it('signs in with email and password', async () => {
    const { view, store, auth } = setup(<SignInScreen allowSignUp={false} />);
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
    const { view, auth } = setup(<SignInScreen allowSignUp={false} />);
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
    const { view } = setup(<SignInScreen allowSignUp={false} />, fake);
    await view;
    await fireEvent.changeText(screen.getByLabelText('Email'), 'ptr@example.com');
    await fireEvent.changeText(screen.getByLabelText('Password'), 'wrong');
    await fireEvent(screen.getByLabelText('Password'), 'submitEditing');
    expect(screen.getByText('Email or password is wrong.')).toBeOnTheScreen();
  });

  it('sends a password reset and confirms with a snackbar', async () => {
    jest.useFakeTimers();
    const { view, auth } = setup(<SignInScreen allowSignUp={false} />);
    await view;
    await fireEvent.press(screen.getByRole('button', { name: 'Forgot password' }));
    expect(screen.getByText('Enter your email address.')).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText('Email'), 'ptr@example.com');
    await fireEvent.press(screen.getByRole('button', { name: 'Forgot password' }));
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith('ptr@example.com');
    expect(screen.getByText('Reset link sent to ptr@example.com')).toBeOnTheScreen();
    await act(async () => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it('offers dev sign-up behind the flag, with a length rule', async () => {
    const { view, auth } = setup(<SignInScreen allowSignUp />);
    await view;
    await fireEvent.changeText(screen.getByLabelText('Email'), 'ptr@example.com');
    await fireEvent.changeText(screen.getByLabelText('Password'), 'short');
    await fireEvent.press(screen.getByRole('button', { name: 'Create account, development only' }));
    expect(screen.getByText('Use at least 8 characters.')).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText('Password'), 'long-enough');
    await fireEvent.press(screen.getByRole('button', { name: 'Create account, development only' }));
    expect(auth.signUp).toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Create account, development only' }));
  });

  it('explains missing configuration and disables sign-in', async () => {
    const { view, store } = setup(<SignInScreen allowSignUp={false} />, fakeSupabase(), false);
    await view;
    await act(async () => {
      await store.dispatch(restoreSession());
    });
    expect(screen.getByText('Supabase isn’t set up yet.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeDisabled();
  });

  it('moves focus from email to password on "next"', async () => {
    const { view } = setup(<SignInScreen allowSignUp={false} />);
    await view;
    await fireEvent(screen.getByLabelText('Email'), 'submitEditing');
    expect(screen.getByLabelText('Password')).toBeOnTheScreen();
  });
});
