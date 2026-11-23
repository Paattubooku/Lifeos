import { useLocalSearchParams } from 'expo-router';

import { MealDetailScreen } from '@/features/food/components/MealDetailScreen';

export default function MealRoute() {
  const { slot } = useLocalSearchParams<{ slot: string }>();
  return <MealDetailScreen slot={String(slot)} />;
}
