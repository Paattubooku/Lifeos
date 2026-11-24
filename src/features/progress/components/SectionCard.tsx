import { ChevronRight, type LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { type Accent, Card, Text, useTheme } from '@/ui';

/** Prog-Tab section: icon + kicker + chevron, headline, sub line, chart on the right. */
export function SectionCard({
  icon: Icon,
  accent,
  kicker,
  value,
  sub,
  delta,
  chart,
  summary,
  onPress,
  testID,
}: {
  icon: LucideIcon;
  accent: Accent;
  kicker: string;
  value: string;
  sub: string;
  delta?: { text: string; tone: 'good' | 'bad' | 'neutral' } | null;
  chart?: ReactNode;
  /** What the chart shows, read out instead of it. */
  summary: string;
  onPress: () => void;
  testID?: string;
}) {
  const { colors } = useTheme();
  const deltaColor =
    delta?.tone === 'good'
      ? colors.accents.success.base
      : delta?.tone === 'bad'
        ? colors.accents.danger.base
        : colors.textSecondary;
  return (
    <Card
      onPress={onPress}
      accessibilityLabel={`${kicker}: ${value}, ${sub}${delta ? `, ${delta.text}` : ''}. ${summary}. Open ${kicker}`}
      padding={16}
      gap={10}
      testID={testID}
    >
      <View style={styles.head}>
        <View style={[styles.icon, { backgroundColor: colors.accents[accent].tint }]}>
          <Icon size={16} color={colors.accents[accent].base} strokeWidth={2} />
        </View>
        <Text variant="kicker" tone="secondary" style={styles.flex}>
          {kicker}
        </Text>
        <ChevronRight size={18} color={colors.textSecondary} strokeWidth={2} />
      </View>
      <View style={styles.body}>
        <View style={styles.flex}>
          <Text variant="metric" num>
            {value}
          </Text>
          <Text variant="caption" tone="secondary">
            {sub}
            {delta ? (
              <Text variant="caption" weight={700} style={{ color: deltaColor }}>
                {`  ${delta.text}`}
              </Text>
            ) : null}
          </Text>
        </View>
        {chart ? <View style={styles.chart}>{chart}</View> : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  body: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  chart: { alignItems: 'flex-end', gap: 4 },
  flex: { flex: 1 },
});
