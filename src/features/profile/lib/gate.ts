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
