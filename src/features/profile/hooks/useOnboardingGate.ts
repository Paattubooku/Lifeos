import { useState } from 'react';

import { useAppSelector } from '@/store';

import { type OnboardingGate, onboardingGate, type SettledGate, stickyGate } from '../lib/gate';
import { useProfile } from './useProfileData';

/**
 * Where a signed-in user goes. Once the gate has settled ('onboard' / 'done'),
 * a later reload of the profile (refetch, cache reset) keeps that answer
 * instead of going back to 'loading': the root swaps the whole navigator for a
 * spinner on 'loading', which rebuilds every screen and closes the keyboard.
 */
export function useOnboardingGate(signedIn: boolean): OnboardingGate {
  const { profile, isLoading, isFetching } = useProfile({ skip: !signedIn });
  const seeding = useAppSelector((s) => s.auth.seed === 'running');
  const user = useAppSelector((s) => s.auth.user?.id ?? null);
  const [settled, setSettled] = useState<SettledGate>(null);

  const gate = onboardingGate({
    signedIn,
    profile,
    loading: isLoading || (isFetching && !profile) || (seeding && !profile),
  });
  // Remember the last settled answer (adjusting state during render, React's documented pattern).
  if (!signedIn) {
    if (settled) setSettled(null);
    return gate;
  }
  if (gate !== 'loading' && (settled?.user !== user || settled.gate !== gate))
    setSettled({ user, gate });
  return stickyGate(gate, settled, user);
}
