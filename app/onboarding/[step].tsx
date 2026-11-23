import { useLocalSearchParams } from 'expo-router';

import { clampStep, OnboardingScreen } from '@/features/profile/components/OnboardingScreen';

export default function OnboardingRoute() {
  const { step } = useLocalSearchParams<{ step: string }>();
  return <OnboardingScreen step={clampStep(step)} />;
}
