import AsyncStorage from '@react-native-async-storage/async-storage';

import { createAsyncStorage, createMmkvStorage, storage, tryCreateMmkv } from '../storage';

function fakeMmkv() {
  const map = new Map<string, string>();
  return {
    getString: (k: string) => map.get(k),
    set: (k: string, v: string) => void map.set(k, v),
    remove: (k: string) => map.delete(k),
  };
}

describe('storage', () => {
  it('MMKV adapter round-trips values through a promise API', async () => {
    const s = createMmkvStorage(fakeMmkv());
    expect(s.backend).toBe('mmkv');
    expect(await s.getItem('k')).toBeNull();
    await s.setItem('k', 'v');
    expect(await s.getItem('k')).toBe('v');
    await s.removeItem('k');
    expect(await s.getItem('k')).toBeNull();
  });

  it('AsyncStorage adapter round-trips values', async () => {
    const s = createAsyncStorage();
    expect(s.backend).toBe('async-storage');
    await s.setItem('a', '1');
    expect(await AsyncStorage.getItem('a')).toBe('1');
    expect(await s.getItem('a')).toBe('1');
    await s.removeItem('a');
    expect(await s.getItem('a')).toBeNull();
  });

  it('uses MMKV when the native module loads', () => {
    const s = tryCreateMmkv(() => ({ createMMKV: () => fakeMmkv() }));
    expect(s?.backend).toBe('mmkv');
  });

  it('falls back (null) when the native module is missing, as in Expo Go', () => {
    const s = tryCreateMmkv(() => {
      throw new Error('NitroModules are not supported in Expo Go');
    });
    expect(s).toBeNull();
  });

  it('exports a ready-to-use storage', () => {
    expect(['mmkv', 'async-storage']).toContain(storage.backend);
  });
});
