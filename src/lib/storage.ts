/**
 * Key-value storage used by redux-persist (and, from F02, the sync queue).
 *
 * PRD §3 picks MMKV. MMKV is a native (Nitro) module that Expo Go does not ship,
 * and the PRD also says to use Expo Go until F11. So:
 *   - dev / preview builds → MMKV (synchronous, fast)
 *   - Expo Go or any build where the native module is missing → AsyncStorage
 * Both are exposed behind the same promise-based interface (DECISIONS.md, F00).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export type KeyValueStorage = {
  readonly backend: 'mmkv' | 'async-storage';
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

type MMKVLike = {
  getString(key: string): string | undefined;
  set(key: string, value: string): void;
  remove(key: string): boolean;
};

export function createMmkvStorage(mmkv: MMKVLike): KeyValueStorage {
  return {
    backend: 'mmkv',
    getItem: (key) => Promise.resolve(mmkv.getString(key) ?? null),
    setItem: (key, value) => {
      mmkv.set(key, value);
      return Promise.resolve();
    },
    removeItem: (key) => {
      mmkv.remove(key);
      return Promise.resolve();
    },
  };
}

export function createAsyncStorage(): KeyValueStorage {
  return {
    backend: 'async-storage',
    getItem: (key) => AsyncStorage.getItem(key),
    setItem: (key, value) => AsyncStorage.setItem(key, value),
    removeItem: (key) => AsyncStorage.removeItem(key),
  };
}

type MmkvModule = { createMMKV: (config: { id: string }) => MMKVLike };

/** Loads MMKV lazily so a missing native module never crashes the app at import time. */
export function tryCreateMmkv(load: () => MmkvModule): KeyValueStorage | null {
  try {
    return createMmkvStorage(load().createMMKV({ id: 'lifeos' }));
  } catch {
    return null;
  }
}

/* istanbul ignore next -- runtime wiring, covered by the helpers above */
function loadMmkvModule(): MmkvModule {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy native import (see header)
  return require('react-native-mmkv') as MmkvModule;
}

export const storage: KeyValueStorage = tryCreateMmkv(loadMmkvModule) ?? createAsyncStorage();
