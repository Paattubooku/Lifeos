import { StyleSheet, View } from 'react-native';

import { isoWeekday } from '@/lib/dates';
import { formatIndianNumber } from '@/lib/format';
import { Text, useTheme } from '@/ui';

const LETTER = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const HEIGHT = 120;

/** Last 7 days vs the goal line (Water design): litres on top, day letters below. */
export function WeekBars({
  days,
  goalMl,
}: {
  days: readonly { date: string; ml: number; hit: boolean }[];
  goalMl: number;
}) {
  const { colors } = useTheme();
  const max = Math.max(goalMl * 1.1, ...days.map((d) => d.ml), 1);
  const goalY = (goalMl / max) * HEIGHT;
  return (
    <View>
      <View style={[styles.chart, { height: HEIGHT + 18 }]}>
        <View
          style={[styles.goal, { bottom: goalY, borderColor: colors.textSecondary }]}
          accessibilityElementsHidden
          importantForAccessibility="no"
        />
        {days.map((d, i) => (
          <View
            key={d.date}
            style={styles.col}
            accessible
            accessibilityLabel={`${d.date}: ${formatIndianNumber(d.ml)} ml${d.hit ? ', goal hit' : ''}`}
          >
            <Text
              variant="caption"
              weight={d.hit ? 700 : 400}
              tone={d.hit ? 'default' : 'secondary'}
              num
            >
              {(d.ml / 1000).toFixed(2)}
            </Text>
            <View
              style={[
                styles.bar,
                {
                  height: Math.max(2, (d.ml / max) * HEIGHT),
                  backgroundColor: d.hit ? colors.accents.water.base : colors.buttonWater,
                  opacity: d.hit ? 1 : 0.55,
                },
              ]}
            />
            <Text variant="caption" tone="secondary">
              {i === 0 || i === days.length - 1
                ? `${LETTER[isoWeekday(d.date) - 1]} ${Number(d.date.slice(8))}`
                : LETTER[isoWeekday(d.date) - 1]}
            </Text>
          </View>
        ))}
      </View>
      <View style={styles.legend}>
        <View style={[styles.swatch, { backgroundColor: colors.accents.water.base }]} />
        <Text variant="caption" tone="secondary">
          Goal hit
        </Text>
        <View style={[styles.swatch, { backgroundColor: colors.buttonWater, opacity: 0.55 }]} />
        <Text variant="caption" tone="secondary">
          Below goal (litres)
        </Text>
        <Text variant="caption" tone="secondary">{`--- ${formatIndianNumber(goalMl)} ml`}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  goal: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderStyle: 'dashed',
    marginBottom: 18,
  },
  col: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  bar: { alignSelf: 'stretch', borderRadius: 8 },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 8 },
  swatch: { width: 10, height: 10, borderRadius: 3 },
});
