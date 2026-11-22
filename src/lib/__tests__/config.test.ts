import { isSignUpEnabled, parseSupabaseConfig } from '../config';

describe('parseSupabaseConfig', () => {
  it('accepts a real URL and key and strips trailing slashes', () => {
    expect(parseSupabaseConfig('https://abc.supabase.co/', ' key ')).toEqual({
      url: 'https://abc.supabase.co',
      anonKey: 'key',
    });
  });

  it('rejects missing values, placeholders and non-URLs', () => {
    expect(parseSupabaseConfig(undefined, 'k')).toBeNull();
    expect(parseSupabaseConfig('https://abc.supabase.co', undefined)).toBeNull();
    expect(parseSupabaseConfig('   ', 'k')).toBeNull();
    expect(parseSupabaseConfig('https://YOUR-PROJECT-REF.supabase.co', 'k')).toBeNull();
    expect(parseSupabaseConfig('https://abc.supabase.co', 'YOUR-ANON-KEY')).toBeNull();
    expect(parseSupabaseConfig('abc.supabase.co', 'k')).toBeNull();
  });
});

describe('isSignUpEnabled', () => {
  it('needs a dev build and the flag', () => {
    expect(isSignUpEnabled(true, '1')).toBe(true);
    expect(isSignUpEnabled(true, undefined)).toBe(false);
    expect(isSignUpEnabled(true, 'true')).toBe(false);
    expect(isSignUpEnabled(false, '1')).toBe(false);
  });
});
