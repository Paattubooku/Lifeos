import { useAppSelector } from '@/store';

import { onboardingGate } from '../lib/gate';
import { useProfile } from './useProfileData';

export function useOnboardingGate(signedIn: boolean) {
  const { profile, isLoading, isFetching } = useProfile({ skip: !signedIn });
  const seeding = useAppSelector((s) => s.auth.seed === 'running');
  return onboardingGate({
    signedIn,
    profile,
    loading: isLoading || (isFetching && !profile) || (seeding && !profile),
  });
}
