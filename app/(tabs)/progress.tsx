import { ChartColumn } from 'lucide-react-native';

import { Card, EmptyState, Screen } from '@/ui';

export default function ProgressScreen() {
  return (
    <Screen title="Progress">
      <Card>
        <EmptyState
          icon={ChartColumn}
          title="Trends live here"
          body="Weight, streaks, sleep and weekly review arrive from F13."
        />
      </Card>
    </Screen>
  );
}
