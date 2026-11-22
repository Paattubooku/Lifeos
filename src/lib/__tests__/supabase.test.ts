const mockCreateClient = jest.fn();

jest.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}));

function load(
  config: { url: string; anonKey: string } | null,
  beforeRequire?: (rn: typeof import('react-native')) => void,
) {
  jest.resetModules();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  beforeRequire?.(require('react-native') as typeof import('react-native'));
  jest.doMock('../config', () => ({ supabaseConfig: config }));
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('../supabase') as typeof import('../supabase');
}

describe('getSupabase', () => {
  beforeEach(() => {
    mockCreateClient.mockReset();
    mockCreateClient.mockReturnValue({
      auth: { startAutoRefresh: jest.fn(), stopAutoRefresh: jest.fn() },
    });
  });

  it('throws a clear error when .env is not set up', () => {
    const mod = load(null);
    expect(mod.isSupabaseConfigured).toBe(false);
    expect(() => mod.getSupabase()).toThrow(mod.SupabaseNotConfiguredError);
  });

  it('creates one client with the anon key and SecureStore-backed session', () => {
    const mod = load({ url: 'https://abc.supabase.co', anonKey: 'anon' });
    const a = mod.getSupabase();
    const b = mod.getSupabase();
    expect(a).toBe(b);
    expect(mockCreateClient).toHaveBeenCalledTimes(1);
    const [url, key, options] = mockCreateClient.mock.calls[0] as [
      string,
      string,
      { auth: Record<string, unknown> },
    ];
    expect(url).toBe('https://abc.supabase.co');
    expect(key).toBe('anon');
    expect(options.auth).toMatchObject({
      storageKey: mod.AUTH_STORAGE_KEY,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    });
    expect(options.auth.storage).toBe(mod.authStorage);
  });

  it('refreshes tokens only in the foreground', () => {
    const listeners: ((s: string) => void)[] = [];
    const mod = load({ url: 'https://abc.supabase.co', anonKey: 'anon' }, (rn) => {
      jest.spyOn(rn.AppState, 'addEventListener').mockImplementation((_t, fn) => {
        listeners.push(fn as (s: string) => void);
        return { remove: jest.fn() } as unknown as ReturnType<typeof rn.AppState.addEventListener>;
      });
    });
    const client = mod.getSupabase() as unknown as {
      auth: { startAutoRefresh: jest.Mock; stopAutoRefresh: jest.Mock };
    };
    listeners.forEach((l) => l('active'));
    expect(client.auth.startAutoRefresh).toHaveBeenCalled();
    listeners.forEach((l) => l('background'));
    expect(client.auth.stopAutoRefresh).toHaveBeenCalled();
  });
});
