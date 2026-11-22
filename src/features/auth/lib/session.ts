/**
 * Pure helpers for the auth flow (no Supabase client here, so they're easy to test).
 */

export type AuthUser = { id: string; email: string | null };

type SessionLike = { user?: { id?: unknown; email?: unknown } | null } | null | undefined;

export function userFromSession(session: SessionLike): AuthUser | null {
  const id = session?.user?.id;
  if (typeof id !== 'string' || id.length === 0) return null;
  const email = session?.user?.email;
  return { id, email: typeof email === 'string' ? email : null };
}

/**
 * Reads the user out of the raw stored session JSON. Used when the app starts
 * offline with an expired access token: Supabase can't refresh it, but the
 * stored session (and its refresh token) is still valid, so PTR stays signed in.
 */
export function readStoredUser(raw: string | null | undefined): AuthUser | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const session =
      (parsed as { currentSession?: SessionLike }).currentSession ?? (parsed as SessionLike);
    const hasRefresh =
      typeof (parsed as { refresh_token?: unknown }).refresh_token === 'string' ||
      typeof (session as { refresh_token?: unknown } | null)?.refresh_token === 'string';
    return hasRefresh ? userFromSession(session) : null;
  } catch {
    return null;
  }
}

type ErrorLike = { name?: unknown; message?: unknown; status?: unknown; code?: unknown };

function asErrorLike(error: unknown): ErrorLike {
  return typeof error === 'object' && error !== null
    ? (error as ErrorLike)
    : { message: String(error) };
}

/** True for "no connection / server unreachable" errors (retry later, don't sign out). */
export function isNetworkError(error: unknown): boolean {
  if (!error) return false;
  const e = asErrorLike(error);
  if (e.name === 'AuthRetryableFetchError') return true;
  if (e.status === 0) return true;
  const msg = typeof e.message === 'string' ? e.message : '';
  return /network request failed|failed to fetch|network error|timed? ?out|load failed/i.test(msg);
}

/** Short, blunt copy for the sign-in screen. */
export function authErrorMessage(error: unknown): string {
  const e = asErrorLike(error);
  if (e.name === 'SupabaseNotConfiguredError') {
    return 'Supabase isn’t set up. Add the URL and anon key to .env and restart.';
  }
  if (isNetworkError(error)) return 'No connection. Try again when you’re online.';
  if (
    e.code === 'invalid_credentials' ||
    (e.status === 400 && /invalid login/i.test(String(e.message)))
  ) {
    return 'Email or password is wrong.';
  }
  if (e.code === 'email_not_confirmed') return 'Confirm your email first (check your inbox).';
  if (
    e.status === 429 ||
    e.code === 'over_request_rate_limit' ||
    e.code === 'over_email_send_rate_limit'
  ) {
    return 'Too many attempts. Wait a minute and try again.';
  }
  if (e.code === 'signup_disabled') return 'Sign-up is turned off for this project.';
  return typeof e.message === 'string' && e.message
    ? e.message
    : 'Something went wrong. Try again.';
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}
