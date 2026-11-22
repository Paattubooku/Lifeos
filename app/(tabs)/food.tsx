import { Soup } from 'lucide-react-native';

import { Card, EmptyState, Screen } from '@/ui';

export default function FoodScreen() {
  return (
    <Screen title="Food">
      <Card>
        <EmptyState
          icon={Soup}
          title="Meals live here"
          body="Meal plan, swaps and coffee arrive in F08."
        />
      </Card>
    </Screen>
  );
}
