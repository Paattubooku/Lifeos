import { onboardingGate } from '../lib/gate';

describe('onboardingGate', () => {
  it.each([
    [{ signedIn: false, profile: undefined, loading: true }, 'done'],
    [{ signedIn: true, profile: { onboarded_at: null }, loading: false }, 'onboard'],
    [{ signedIn: true, profile: { onboarded_at: '2026-11-23T05:00:00Z' }, loading: true }, 'done'],
    [{ signedIn: true, profile: undefined, loading: true }, 'loading'],
    [{ signedIn: true, profile: null, loading: true }, 'loading'],
    // Offline with an empty cache: never stuck on a spinner.
    [{ signedIn: true, profile: undefined, loading: false }, 'done'],
  ] as const)('%p → %s', (input, gate) => {
    expect(onboardingGate(input)).toBe(gate);
  });
});
