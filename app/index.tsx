import { Redirect } from 'expo-router';

import { selectIsSignedIn } from '@/features/auth/selectors';
import { useAppSelector } from '@/store';

/** Signed in → Today (F03 will route first-run users to onboarding); otherwise sign-in. */
export default function Index() {
  const signedIn = useAppSelector(selectIsSignedIn);
  return <Redirect href={signedIn ? '/today' : '/sign-in'} />;
}
