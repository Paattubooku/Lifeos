/**
 * Public runtime config from `.env` (EXPO_PUBLIC_* only — never secrets).
 * Expo inlines `process.env.EXPO_PUBLIC_*` at build time, so the values must be
 * read with static property access here and validated by the pure helper.
 */

export type SupabaseConfig = { url: string; anonKey: string };

/** Returns the config, or null when `.env` is missing or still has the placeholders. */
export function parseSupabaseConfig(
  url: string | undefined,
  anonKey: string | undefined,
): SupabaseConfig | null {
  const u = url?.trim();
  const k = anonKey?.trim();
  if (!u || !k) return null;
  if (!/^https?:\/\/[^\s/]+/.test(u)) return null;
  if (u.includes('YOUR-PROJECT-REF') || k === 'YOUR-ANON-KEY') return null;
  return { url: u.replace(/\/+$/, ''), anonKey: k };
}

export const supabaseConfig = parseSupabaseConfig(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
);

/** Sign-up exists only in dev builds with EXPO_PUBLIC_ENABLE_SIGNUP=1 (PRD F01). */
export function isSignUpEnabled(dev: boolean, flag: string | undefined): boolean {
  return dev && flag === '1';
}

export const signUpEnabled = isSignUpEnabled(__DEV__, process.env.EXPO_PUBLIC_ENABLE_SIGNUP);
