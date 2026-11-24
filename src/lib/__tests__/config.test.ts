import { parseSupabaseConfig } from '../config';

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
