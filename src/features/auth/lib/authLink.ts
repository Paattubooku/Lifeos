/**
 * Email links (sign-up confirmation, password reset) open the app at
 * `<scheme>://auth-callback` (`exp://…/--/auth-callback` in Expo Go). Supabase
 * puts the session in the fragment (`#access_token=…&refresh_token=…&type=signup`),
 * a PKCE `?code=…`, or an error. Pure, so it is unit-tested.
 */
export const AUTH_CALLBACK_PATH = 'auth-callback';

export type AuthLink =
  | { kind: 'session'; accessToken: string; refreshToken: string; recovery: boolean }
  | { kind: 'code'; code: string; recovery: boolean }
  | { kind: 'error'; message: string };

function params(part: string): URLSearchParams {
  return new URLSearchParams(part.replace(/^[?#]/, ''));
}

/** The auth payload of an incoming URL, or null when it isn't an auth callback. */
export function parseAuthLink(url: string | null | undefined): AuthLink | null {
  if (!url || !url.includes(AUTH_CALLBACK_PATH)) return null;
  const hashAt = url.indexOf('#');
  const beforeHash = hashAt === -1 ? url : url.slice(0, hashAt);
  const queryAt = beforeHash.indexOf('?');
  const query = params(queryAt === -1 ? '' : beforeHash.slice(queryAt));
  const hash = params(hashAt === -1 ? '' : url.slice(hashAt));
  const get = (k: string) => hash.get(k) ?? query.get(k);

  const error = get('error_description') ?? get('error');
  if (error) {
    const expired = get('error_code') === 'otp_expired' || /expired/i.test(error);
    return {
      kind: 'error',
      message: expired
        ? 'That link has expired. Sign in, or ask for a new one.'
        : `Couldn’t sign you in: ${error.replace(/\+/g, ' ')}`,
    };
  }
  const recovery = get('type') === 'recovery';
  const accessToken = get('access_token');
  const refreshToken = get('refresh_token');
  if (accessToken && refreshToken) return { kind: 'session', accessToken, refreshToken, recovery };
  const code = get('code');
  if (code) return { kind: 'code', code, recovery };
  return null;
}
