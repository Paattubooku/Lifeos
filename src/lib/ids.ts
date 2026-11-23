import { randomUUID } from 'expo-crypto';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

/** New random client_id (UUID v4) for an offline-first row. */
export function newClientId(): string {
  const id = randomUUID();
  if (!isUuid(id)) throw new Error('randomUUID returned an invalid id');
  return id;
}
