import { Redirect } from 'expo-router';

import { selectIsSignedIn } from '@/features/auth/selectors';
import { useOnboardingGate } from '@/features/profile/hooks/useOnboardingGate';
import { useAppSelector } from '@/store';

/** Signed out → sign-in; first run → onboarding; otherwise Today. */
export default function Index() {
  const signedIn = useAppSelector(selectIsSignedIn);
  const gate = useOnboardingGate(signedIn);
  if (!signedIn) return <Redirect href="/sign-in" />;
  if (gate === 'onboard') {
    return <Redirect href={{ pathname: '/onboarding/[step]', params: { step: '1' } }} />;
  }
  return <Redirect href="/today" />;
}
