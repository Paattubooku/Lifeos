import { useLocalSearchParams } from 'expo-router';

import { TemplateScreen } from '@/features/routine/components/TemplateScreen';

export default function TemplateRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <TemplateScreen id={String(id)} />;
}
