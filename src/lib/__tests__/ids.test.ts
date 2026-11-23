import { isUuid, newClientId } from '../ids';

describe('newClientId', () => {
  it('returns distinct UUID v4 values', () => {
    const a = newClientId();
    const b = newClientId();
    expect(isUuid(a)).toBe(true);
    expect(a).not.toBe(b);
  });

  it('isUuid rejects junk', () => {
    expect(isUuid('nope')).toBe(false);
    expect(isUuid(42)).toBe(false);
    expect(isUuid('00000000-0000-4000-a000-00000000000a')).toBe(true);
  });

  it('refuses a bad id from the platform', () => {
    jest.resetModules();
    jest.doMock('expo-crypto', () => ({ randomUUID: () => 'bad' }));
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { newClientId: broken } = require('../ids') as typeof import('../ids');
    expect(() => broken()).toThrow('invalid id');
  });
});
