import { useLocalSearchParams } from 'expo-router';

import { TransactionsScreen } from '@/features/money/components/TransactionsScreen';

export default function TransactionsRoute() {
  const { category } = useLocalSearchParams<{ category?: string }>();
  return <TransactionsScreen {...(category ? { category } : {})} />;
}
