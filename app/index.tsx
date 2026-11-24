import { Redirect } from 'expo-router';

import { selectIsSignedIn } from '@/features/auth/selectors';
import { useOnboardingGate } from '@/features/profile/hooks/useOnboardingGate';
import { useProfile } from '@/features/profile/hooks/useProfileData';
import { useAppSelector } from '@/store';

/** Signed out → sign-in; first run → onboarding → app tour (once); otherwise Today. */
export default function Index() {
  const signedIn = useAppSelector(selectIsSignedIn);
  const gate = useOnboardingGate(signedIn);
  const { profile } = useProfile({ skip: !signedIn });
  if (!signedIn) return <Redirect href="/sign-in" />;
  if (gate === 'onboard') {
    return <Redirect href={{ pathname: '/onboarding/[step]', params: { step: '1' } }} />;
  }
  if (profile && !profile.tour_seen_at) return <Redirect href="/tour" />;
  return <Redirect href="/today" />;
}
