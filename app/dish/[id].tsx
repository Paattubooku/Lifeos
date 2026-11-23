import { useLocalSearchParams } from 'expo-router';

import { DishEditorScreen } from '@/features/food/components/DishEditorScreen';

export default function DishRoute() {
  const { id, meal, item } = useLocalSearchParams<{ id: string; meal?: string; item?: string }>();
  return <DishEditorScreen id={String(id)} mealId={meal} itemId={item} />;
}
