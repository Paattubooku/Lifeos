import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { useNow } from '@/features/today/hooks/useNow';
import { useToday } from '@/features/today/hooks/useToday';
import { Card, Screen, StatusChip, Text, useTheme } from '@/ui';

import { useTrain } from '../hooks/useTrain';

/** Exercise library (list pattern from Routine-Blocks, DESIGN_NOTES C). */
export function ExercisesScreen({ now: fixedNow }: { now?: number } = {}) {
  const ticking = useNow(60_000);
  const now = fixedNow ?? ticking;
  const router = useRouter();
  const { colors } = useTheme();
  const t = useToday(now);
  const train = useTrain(t);
  const byMuscle = new Map<string, typeof train.program.exercises>();
  for (const e of train.program.exercises)
    byMuscle.set(e.muscle, [...(byMuscle.get(e.muscle) ?? []), e]);
  const groups = [...byMuscle.entries()].sort(([a], [b]) => a.localeCompare(b));
  return (
    <Screen
      title="Exercise library"
      subtitle={`${train.program.exercises.length} dumbbell, bench and bodyweight exercises`}
      withTabBar={false}
      back={{ label: 'Train', onPress: () => router.back() }}
    >
      {groups.map(([muscle, list]) => (
        <Card key={muscle} kicker={muscle} padding={14} gap={0} testID={`muscle-${muscle}`}>
          {list.map((e, n) => (
            <View
              key={e.id}
              style={[
                styles.row,
                n > 0 ? { borderTopWidth: 1, borderColor: colors.hairline } : null,
              ]}
            >
              <View style={styles.titleRow}>
                <Text variant="body" weight={700}>
                  {e.name}
                </Text>
                {e.unilateral ? <StatusChip label="per side" tone="neutral" /> : null}
              </View>
              <Text variant="caption" tone="secondary">
                {e.equipment}
              </Text>
              {e.cue ? <Text variant="sub">{e.cue}</Text> : null}
            </View>
          ))}
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { paddingVertical: 10, gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
