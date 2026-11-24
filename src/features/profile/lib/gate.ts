export type OnboardingGate = 'loading' | 'onboard' | 'done';

/**
 * Where a signed-in user goes (PRD F03):
 *  - profile known → onboarding until `onboarded_at` is set, then the app;
 *  - profile still loading (first launch, seed running) → wait;
 *  - no profile and nothing loading (offline with an empty cache) → the app, so
 *    an offline phone is never stuck on a spinner.
 */
export function onboardingGate(input: {
  signedIn: boolean;
  profile: { onboarded_at: string | null } | null | undefined;
  loading: boolean;
}): OnboardingGate {
  if (!input.signedIn) return 'done';
  if (input.profile) return input.profile.onboarded_at ? 'done' : 'onboard';
  return input.loading ? 'loading' : 'done';
}

export type SettledGate = { user: string | null; gate: OnboardingGate } | null;

/**
 * Keyboard fix: after the gate has settled for this account, a reload ('loading')
 * keeps the settled answer, so the root never swaps the navigator for a spinner
 * mid-use. A different account (or none settled yet) gets the live value.
 */
export function stickyGate(
  live: OnboardingGate,
  settled: SettledGate,
  user: string | null,
): OnboardingGate {
  if (live !== 'loading') return live;
  return settled?.user === user ? settled.gate : live;
}
