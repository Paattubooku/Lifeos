import { useLocalSearchParams } from 'expo-router';

import { SessionScreen } from '@/features/train/components/SessionScreen';

export default function SessionRoute() {
  const { date } = useLocalSearchParams<{ date: string }>();
  return <SessionScreen date={String(date)} />;
}
