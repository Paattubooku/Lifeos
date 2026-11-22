import {
  CHUNK_SIZE,
  createChunkedSecureStorage,
  safeKey,
  type SecureStoreLike,
  splitIntoChunks,
} from '../secureStorage';

function fakeSecureStore() {
  const map = new Map<string, string>();
  const store: SecureStoreLike = {
    getItemAsync: async (k) => map.get(k) ?? null,
    setItemAsync: async (k, v) => {
      if (!/^[A-Za-z0-9._-]+$/.test(k)) throw new Error(`invalid key ${k}`);
      if (v.length > 2048) throw new Error('value too large for SecureStore');
      map.set(k, v);
    },
    deleteItemAsync: async (k) => void map.delete(k),
  };
  return { store, map };
}

describe('splitIntoChunks', () => {
  it('splits by size and keeps empty strings', () => {
    expect(splitIntoChunks('abcdef', 4)).toEqual(['abcd', 'ef']);
    expect(splitIntoChunks('', 4)).toEqual(['']);
    expect(splitIntoChunks('a'.repeat(CHUNK_SIZE)).length).toBe(1);
    expect(splitIntoChunks('a'.repeat(CHUNK_SIZE + 1)).length).toBe(2);
  });
});

describe('safeKey', () => {
  it('replaces characters SecureStore rejects', () => {
    expect(safeKey('sb-abc-auth-token')).toBe('sb-abc-auth-token');
    expect(safeKey('a:b/c d')).toBe('a_b_c_d');
  });
});

describe('createChunkedSecureStorage', () => {
  const big = JSON.stringify({
    access_token: 'x'.repeat(3000),
    refresh_token: 'r',
    user: { id: 'u' },
  });

  it('round-trips a session larger than one SecureStore value', async () => {
    const { store, map } = fakeSecureStore();
    const s = createChunkedSecureStorage(store);
    await s.setItem('lifeos-auth', big);
    expect(map.get('lifeos-auth.n')).toBe('2');
    expect(await s.getItem('lifeos-auth')).toBe(big);
  });

  it('returns null when nothing is stored', async () => {
    const s = createChunkedSecureStorage(fakeSecureStore().store);
    expect(await s.getItem('missing')).toBeNull();
  });

  it('removes stale chunks when the value shrinks, and on remove', async () => {
    const { store, map } = fakeSecureStore();
    const s = createChunkedSecureStorage(store);
    await s.setItem('k', big);
    await s.setItem('k', 'small');
    expect(map.has('k.1')).toBe(false);
    expect(await s.getItem('k')).toBe('small');
    await s.removeItem('k');
    expect(map.size).toBe(0);
    expect(await s.getItem('k')).toBeNull();
  });

  it('treats a torn write (missing chunk) or a bad count as no session', async () => {
    const { store, map } = fakeSecureStore();
    const s = createChunkedSecureStorage(store);
    await s.setItem('k', big);
    map.delete('k.1');
    expect(await s.getItem('k')).toBeNull();
    map.set('j.n', 'garbage');
    expect(await s.getItem('j')).toBeNull();
  });
});
