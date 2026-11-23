import { supabaseQuery, unwrapList, unwrapOne } from '../supabaseQuery';

const client = { tag: 'client' };
const api = (over: object = {}) => ({
  extra: { isConfigured: true, getSupabase: () => client, storageKey: 'k', now: () => 42, ...over },
  dispatch: jest.fn(),
});

describe('supabaseQuery', () => {
  it('returns data and marks every table as freshly read', async () => {
    const a = api();
    const read = jest.fn(async () => [1, 2]);
    await expect(supabaseQuery(a, ['profile', 'weight_log'], read)).resolves.toEqual({
      data: [1, 2],
    });
    expect(read).toHaveBeenCalledWith(client);
    expect(a.dispatch.mock.calls.map(([action]) => action)).toEqual([
      { type: 'sync/serverRead', payload: { table: 'profile', startedAt: 42 } },
      { type: 'sync/serverRead', payload: { table: 'weight_log', startedAt: 42 } },
    ]);
  });

  it('turns thrown errors into RTK Query errors without marking reads', async () => {
    const a = api();
    await expect(
      supabaseQuery(a, ['profile'], async () => {
        throw { message: 'boom' };
      }),
    ).resolves.toEqual({ error: { message: 'boom' } });
    await expect(
      supabaseQuery(a, ['profile'], async () => {
        throw 'plain';
      }),
    ).resolves.toEqual({ error: { message: 'plain' } });
    expect(a.dispatch).not.toHaveBeenCalled();
  });

  it('errors when Supabase is not configured; falls back to Date.now', async () => {
    await expect(
      supabaseQuery(api({ isConfigured: false }), ['profile'], async () => 1),
    ).resolves.toEqual({ error: { message: 'Supabase is not configured' } });
    const a = api({ now: undefined });
    await supabaseQuery(a, ['profile'], async () => 1);
    expect(a.dispatch.mock.calls[0]?.[0].payload.startedAt).toEqual(expect.any(Number));
  });
});

describe('unwrap', () => {
  it('unwrapOne', () => {
    expect(unwrapOne({ data: { a: 1 }, error: null })).toEqual({ a: 1 });
    expect(unwrapOne({ data: null, error: null })).toBeNull();
    expect(() => unwrapOne({ data: null, error: new Error('x') })).toThrow('x');
  });

  it('unwrapList', () => {
    expect(unwrapList({ data: [1], error: null })).toEqual([1]);
    expect(unwrapList({ data: null, error: null })).toEqual([]);
    expect(() => unwrapList({ data: null, error: new Error('y') })).toThrow('y');
  });
});
