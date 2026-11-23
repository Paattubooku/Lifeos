import { Droplet } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { formatClock, formatIndianNumber } from '@/lib/format';
import { Button, Card, ProgressBar, Text, useTheme } from '@/ui';

import { paceLine, showBehind } from '../lib/copy';
import type { Pace } from '../lib/pace';

export type WaterCardProps = {
  totalMl: number;
  targetMl: number;
  pace: Pace;
  targetTime: string;
  wakeTime: string;
  beforeWake: boolean;
  onOpen: () => void;
  onDrink: (ml: number) => void;
};

/** Today's water card: bar with the pace tick, the gap and a one-tap catch-up (Today 1:15 pm design). */
export function WaterCard(p: WaterCardProps) {
  const { colors } = useTheme();
  const line = paceLine(p.pace, p);
  const behind = showBehind(p.pace);
  return (
    <Card
      onPress={p.onOpen}
      accessibilityLabel={`Water ${p.totalMl} of ${p.targetMl} ml. ${line.text} Open water`}
      testID="water-card"
    >
      <View style={styles.head}>
        <View style={[styles.icon, { backgroundColor: colors.buttonWater }]}>
          <Droplet size={18} color={colors.onButton} strokeWidth={2.2} />
        </View>
        <Text variant="heading" style={styles.flex}>
          Water
        </Text>
        <Text variant="heading" num>
          {formatIndianNumber(p.totalMl)}
          <Text
            variant="sub"
            tone="secondary"
            num
          >{` / ${formatIndianNumber(p.targetMl)} ml`}</Text>
        </Text>
      </View>
      <ProgressBar
        progress={p.targetMl > 0 ? p.totalMl / p.targetMl : 0}
        pace={
          p.pace.status === 'sleeping' || p.targetMl <= 0 ? undefined : p.pace.expected / p.targetMl
        }
        accent="water"
        accessibilityLabel={`Water ${Math.round((p.totalMl / Math.max(p.targetMl, 1)) * 100)} percent`}
      />
      <View style={styles.row}>
        <Text variant="sub" weight={600} tone={line.tone} style={styles.flex}>
          {line.text}
        </Text>
        {behind ? (
          <Button
            variant="outline"
            size="sm"
            label={`+${p.pace.suggested} ml`}
            accessibilityLabel={`Drink ${p.pace.suggested} ml now`}
            onPress={() => p.onDrink(p.pace.suggested)}
          />
        ) : null}
      </View>
      {p.pace.status === 'behind' || p.pace.status === 'on_track' ? (
        <Text variant="caption" tone="secondary">
          {`White tick = pace for now (${formatIndianNumber(p.pace.expected)} ml) · runs to ${formatClock(p.targetTime)}`}
        </Text>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
