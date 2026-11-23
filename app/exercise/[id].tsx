import { useLocalSearchParams } from 'expo-router';

import { ExerciseHistoryScreen } from '@/features/train/components/ExerciseHistoryScreen';

export default function ExerciseHistoryRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ExerciseHistoryScreen id={String(id)} />;
}
