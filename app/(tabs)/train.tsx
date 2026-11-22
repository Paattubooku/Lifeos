import { Dumbbell } from 'lucide-react-native';

import { Card, EmptyState, Screen } from '@/ui';

export default function TrainScreen() {
  return (
    <Screen title="Train">
      <Card>
        <EmptyState
          icon={Dumbbell}
          title="Training lives here"
          body="Today's session and the set logger arrive in F11."
        />
      </Card>
    </Screen>
  );
}
