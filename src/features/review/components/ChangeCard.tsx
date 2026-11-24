import { Pencil } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { Card, Text, useTheme } from '@/ui';

import type { Summary } from '../lib/review';

/** Review-4-Monday design: last week's change, pinned to Today all week. */
export function ChangeCard({
  text,
  summary,
  onPress,
}: {
  text: string;
  summary: Partial<Summary> | null;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const facts = [
    summary?.worst ? `${summary.worst.title} ${summary.worst.pct}%` : null,
    typeof summary?.avgSleep === 'number' ? `Sleep ${summary.avgSleep} h` : null,
  ].filter(Boolean);
  return (
    <Card
      onPress={onPress}
      accessibilityLabel={`This week's change: ${text}. Open reviews`}
      padding={14}
      testID="change-card"
      style={{ borderColor: colors.accents.primary.base }}
    >
      <View style={styles.row}>
        <View style={[styles.icon, { backgroundColor: colors.buttonPrimary }]}>
          <Pencil size={16} color={colors.onButton} strokeWidth={2} />
        </View>
        <View style={styles.flex}>
          <Text variant="kicker" style={{ color: colors.accents.primary.base }}>
            This week’s change · from Sunday
          </Text>
          <Text variant="body" weight={600}>
            {text}
          </Text>
          {facts.length ? (
            <Text variant="caption" tone="secondary">{`Last week: ${facts.join(' · ')}`}</Text>
          ) : null}
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12 },
  flex: { flex: 1, gap: 2 },
  icon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
});
