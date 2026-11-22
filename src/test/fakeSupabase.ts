import type { AuthDeps } from '@/features/auth/slice';
import type { AsyncKeyValue } from '@/lib/secureStorage';
import type { LifeosClient } from '@/lib/supabase';
import { makeStore } from '@/store';

type Result<T> = Promise<{ data: T; error: unknown }>;

export type FakeAuth = {
  getSession: jest.Mock<Result<{ session: unknown }>, []>;
  signInWithPassword: jest.Mock<
    Result<{ session: unknown }>,
    [{ email: string; password: string }]
  >;
  signUp: jest.Mock<Result<{ session: unknown }>, [{ email: string; password: string }]>;
  resetPasswordForEmail: jest.Mock<Result<object>, [string]>;
  signOut: jest.Mock<Promise<{ error: unknown }>, [{ scope: string }?]>;
};

export const SESSION = {
  access_token: 'access',
  refresh_token: 'refresh',
  user: { id: '00000000-0000-4000-a000-00000000000a', email: 'ptr@example.com' },
};

/** A Supabase client double with only what the auth flow touches. */
export function fakeSupabase() {
  const auth: FakeAuth = {
    getSession: jest.fn<Result<{ session: unknown }>, []>(async () => ({
      data: { session: null },
      error: null,
    })),
    signInWithPassword: jest.fn<
      Result<{ session: unknown }>,
      [{ email: string; password: string }]
    >(async () => ({ data: { session: SESSION }, error: null })),
    signUp: jest.fn<Result<{ session: unknown }>, [{ email: string; password: string }]>(
      async () => ({ data: { session: SESSION }, error: null }),
    ),
    resetPasswordForEmail: jest.fn<Result<object>, [string]>(async () => ({
      data: {},
      error: null,
    })),
    signOut: jest.fn<Promise<{ error: unknown }>, [{ scope: string }?]>(async () => ({
      error: null,
    })),
  };
  const rpc = jest.fn<Result<object>, [string]>(async () => ({ data: {}, error: null }));
  const client = { auth, rpc } as unknown as LifeosClient;
  return { client, auth, rpc };
}

export function memoryStorage(initial: Record<string, string> = {}): AsyncKeyValue {
  const map = new Map(Object.entries(initial));
  return {
    getItem: async (k) => map.get(k) ?? null,
    setItem: async (k, v) => void map.set(k, v),
    removeItem: async (k) => void map.delete(k),
  };
}

export function storeWithFake(fake = fakeSupabase(), overrides: Partial<AuthDeps> = {}) {
  const deps: AuthDeps = {
    getSupabase: () => fake.client,
    isConfigured: true,
    storageKey: 'lifeos-auth',
    authStorage: memoryStorage(),
    ...overrides,
  };
  return { store: makeStore(deps), ...fake };
}
