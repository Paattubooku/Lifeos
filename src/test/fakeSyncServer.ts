import type { Persistor } from 'redux-persist';

import type { Row } from '@/lib/sync';

import { fakeSupabase } from './fakeSupabase';

type Fault = { kind: 'error'; error: unknown } | { kind: 'ack-lost' };

/**
 * In-memory stand-in for PostgREST: `upsert(..., { onConflict: 'client_id' })`
 * merges by client_id exactly like the real unique constraint, so duplicate
 * pushes can never create duplicate rows.
 */
export function fakeSyncServer() {
  const tables = new Map<string, Map<string, Row>>();
  const faults: Fault[] = [];
  let offline = false;
  let calls = 0;

  const table = (name: string) => {
    let t = tables.get(name);
    if (!t) tables.set(name, (t = new Map()));
    return t;
  };

  function respond(write: () => void): Promise<{ error: unknown }> {
    calls++;
    if (offline) return Promise.reject(new TypeError('Network request failed'));
    const fault = faults.shift();
    if (fault?.kind === 'error') return Promise.resolve({ error: fault.error });
    write();
    if (fault?.kind === 'ack-lost') return Promise.reject(new TypeError('Network request failed'));
    return Promise.resolve({ error: null });
  }

  const from = (name: string) => ({
    upsert: (row: Row, options: { onConflict: string }) =>
      respond(() => {
        if (options.onConflict !== 'client_id') throw new Error('expected onConflict client_id');
        const id = String(row.client_id);
        table(name).set(id, { ...table(name).get(id), ...row });
      }),
    update: (row: Row) => ({
      eq: (column: string, value: string) =>
        respond(() => {
          if (column !== 'client_id') throw new Error('expected eq client_id');
          const existing = table(name).get(value);
          if (existing) table(name).set(value, { ...existing, ...row });
        }),
    }),
  });

  const fake = fakeSupabase();
  const client = Object.assign(fake.client, { from });

  return {
    client,
    auth: fake.auth,
    rows: (name: string) => [...table(name).values()],
    setOffline: (v: boolean) => {
      offline = v;
    },
    failNext: (...f: Fault[]) => faults.push(...f),
    get calls() {
      return calls;
    },
  };
}

export function waitForRehydrate(persistor: Persistor): Promise<void> {
  return new Promise((resolve) => {
    if (persistor.getState().bootstrapped) return resolve();
    const unsubscribe = persistor.subscribe(() => {
      if (persistor.getState().bootstrapped) {
        unsubscribe();
        resolve();
      }
    });
  });
}
