/**
 * Supabase session storage on top of expo-secure-store (Keychain / Keystore).
 *
 * SecureStore warns above ~2 KB per value and a Supabase session (two JWTs +
 * user) is usually larger, so values are split into chunks:
 *   `${key}.n`   → number of chunks
 *   `${key}.0…`  → the pieces
 */

export type SecureStoreLike = {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
};

export type AsyncKeyValue = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

export const CHUNK_SIZE = 1800;

export function splitIntoChunks(value: string, size = CHUNK_SIZE): string[] {
  if (value.length === 0) return [''];
  const chunks: string[] = [];
  for (let i = 0; i < value.length; i += size) chunks.push(value.slice(i, i + size));
  return chunks;
}

/** SecureStore keys may only contain letters, digits, ".", "-" and "_". */
export function safeKey(key: string): string {
  return key.replace(/[^A-Za-z0-9._-]/g, '_');
}

export function createChunkedSecureStorage(store: SecureStoreLike): AsyncKeyValue {
  const countKey = (key: string) => `${safeKey(key)}.n`;
  const chunkKey = (key: string, i: number) => `${safeKey(key)}.${i}`;

  async function readCount(key: string): Promise<number> {
    const raw = await store.getItemAsync(countKey(key));
    const n = raw === null ? 0 : Number.parseInt(raw, 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  async function removeChunks(key: string, from: number, to: number) {
    for (let i = from; i < to; i++) await store.deleteItemAsync(chunkKey(key, i));
  }

  return {
    async getItem(key) {
      const n = await readCount(key);
      if (n === 0) return null;
      const parts: string[] = [];
      for (let i = 0; i < n; i++) {
        const part = await store.getItemAsync(chunkKey(key, i));
        if (part === null) return null; // torn write — treat as signed out
        parts.push(part);
      }
      return parts.join('');
    },
    async setItem(key, value) {
      const old = await readCount(key);
      const chunks = splitIntoChunks(value);
      for (let i = 0; i < chunks.length; i++) {
        await store.setItemAsync(chunkKey(key, i), chunks[i] ?? '');
      }
      await store.setItemAsync(countKey(key), String(chunks.length));
      await removeChunks(key, chunks.length, old);
    },
    async removeItem(key) {
      const n = await readCount(key);
      await store.deleteItemAsync(countKey(key));
      await removeChunks(key, 0, n);
    },
  };
}
