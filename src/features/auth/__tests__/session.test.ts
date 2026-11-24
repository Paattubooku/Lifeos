import {
  authErrorMessage,
  isNetworkError,
  isValidEmail,
  readStoredUser,
  userFromSession,
} from '../lib/session';

describe('userFromSession', () => {
  it('extracts id and email', () => {
    expect(userFromSession({ user: { id: 'u1', email: 'a@b.co' } })).toEqual({
      id: 'u1',
      email: 'a@b.co',
    });
    expect(userFromSession({ user: { id: 'u1' } })).toEqual({ id: 'u1', email: null });
  });

  it('returns null without a usable user', () => {
    expect(userFromSession(null)).toBeNull();
    expect(userFromSession(undefined)).toBeNull();
    expect(userFromSession({ user: null })).toBeNull();
    expect(userFromSession({ user: { id: '' } })).toBeNull();
  });
});

describe('readStoredUser (offline launch)', () => {
  it('reads the user from a stored session that has a refresh token', () => {
    const raw = JSON.stringify({
      access_token: 'x',
      refresh_token: 'r',
      user: { id: 'u1', email: 'a@b.co' },
    });
    expect(readStoredUser(raw)).toEqual({ id: 'u1', email: 'a@b.co' });
  });

  it('supports the older { currentSession } shape', () => {
    const raw = JSON.stringify({ currentSession: { refresh_token: 'r', user: { id: 'u2' } } });
    expect(readStoredUser(raw)).toEqual({ id: 'u2', email: null });
  });

  it('rejects missing, corrupt or refresh-less data', () => {
    expect(readStoredUser(null)).toBeNull();
    expect(readStoredUser('')).toBeNull();
    expect(readStoredUser('{not json')).toBeNull();
    expect(readStoredUser('42')).toBeNull();
    expect(readStoredUser('null')).toBeNull();
    expect(readStoredUser(JSON.stringify({ user: { id: 'u1' } }))).toBeNull();
  });
});

describe('isNetworkError', () => {
  it.each([
    [{ name: 'AuthRetryableFetchError', message: 'x' }],
    [{ status: 0 }],
    [new TypeError('Network request failed')],
    [new Error('Failed to fetch')],
    [{ message: 'Request timed out' }],
  ])('detects %p', (e) => {
    expect(isNetworkError(e)).toBe(true);
  });

  it('ignores auth errors and empty values', () => {
    expect(isNetworkError(null)).toBe(false);
    expect(
      isNetworkError({
        status: 400,
        code: 'invalid_credentials',
        message: 'Invalid login credentials',
      }),
    ).toBe(false);
  });
});

describe('authErrorMessage', () => {
  it.each([
    [
      { name: 'SupabaseNotConfiguredError' },
      'Supabase isn’t set up. Add the URL and anon key to .env and restart.',
    ],
    [new TypeError('Network request failed'), 'No connection. Try again when you’re online.'],
    [{ code: 'invalid_credentials', status: 400 }, 'Email or password is wrong.'],
    [{ status: 400, message: 'Invalid login credentials' }, 'Email or password is wrong.'],
    [{ code: 'email_not_confirmed' }, 'Confirm your email first (check your inbox).'],
    [{ status: 429 }, 'Too many attempts. Wait a minute and try again.'],
    [
      { code: 'over_email_send_rate_limit' },
      'Too many emails sent from LifeOS just now. Try again in an hour.',
    ],
    [{ code: 'signup_disabled' }, 'Sign-up is turned off for this project.'],
    [{ message: 'Weird server error' }, 'Weird server error'],
    [{}, 'Something went wrong. Try again.'],
    ['plain string', 'plain string'],
  ])('%p → %s', (e, msg) => {
    expect(authErrorMessage(e)).toBe(msg);
  });
});

describe('isValidEmail', () => {
  it('accepts normal addresses and trims', () => {
    expect(isValidEmail('ptr@example.com')).toBe(true);
    expect(isValidEmail('  ptr@example.com ')).toBe(true);
  });
  it('rejects junk', () => {
    expect(isValidEmail('')).toBe(false);
    expect(isValidEmail('ptr')).toBe(false);
    expect(isValidEmail('ptr@example')).toBe(false);
    expect(isValidEmail('p tr@example.com')).toBe(false);
  });
});
