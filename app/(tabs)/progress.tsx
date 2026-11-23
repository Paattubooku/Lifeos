import { useRouter } from 'expo-router';
import { ChartColumn, Flame, Scale } from 'lucide-react-native';

import { Card, EmptyState, MenuRow, Screen } from '@/ui';

/** Placeholder until F16 builds the Progress tab; links to what exists already. */
export default function ProgressScreen() {
  const router = useRouter();
  return (
    <Screen title="Progress">
      <Card padding={14} gap={0}>
        <MenuRow
          icon={Scale}
          title="Weight"
          sub="Weigh-in, trend, projection, energy"
          onPress={() => router.push('/weight')}
          divider
        />
        <MenuRow
          icon={Flame}
          accent="success"
          title="Streaks"
          sub="Current, best, 30-day heatmap"
          onPress={() => router.push('/streaks')}
        />
      </Card>
      <Card>
        <EmptyState
          icon={ChartColumn}
          title="More trends here"
          body="The full Progress tab (sleep, weekly review) arrives with F16."
        />
      </Card>
    </Screen>
  );
}
