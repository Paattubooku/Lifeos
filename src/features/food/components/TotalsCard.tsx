import { Check, Info, TriangleAlert, Zap } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { formatIndianNumber } from '@/lib/format';
import { Card, ProgressBar, Text, useTheme } from '@/ui';

import type { Insight } from '../lib/insights';
import type { DayFood } from '../lib/plan';

const left = (target: number, have: number, unit: string) =>
  have <= target
    ? `${formatIndianNumber(target - have)}${unit} left`
    : `${formatIndianNumber(have - target)}${unit} over`;

/** "EATEN TODAY" bars with the plan's pace tick, insight chips and where the day lands (Food-Tab design). */
export function TotalsCard({
  day,
  kcalTarget,
  proteinTarget,
  chips,
  hasPlan,
}: {
  day: DayFood;
  kcalTarget: number;
  proteinTarget: number;
  chips: readonly Insight[];
  hasPlan: boolean;
}) {
  const { colors } = useTheme();
  const toneColor = (t: Insight['tone']) =>
    t === 'danger'
      ? colors.accents.danger.base
      : t === 'warning'
        ? colors.accents.protein.base
        : colors.accents.primary.base;
  return (
    <>
      <Card kicker="Eaten today" testID="food-totals">
        <View style={styles.row}>
          <Text variant="metric" num>
            {formatIndianNumber(day.eaten.kcal)}
            <Text
              variant="sub"
              tone="secondary"
              num
            >{` / ${formatIndianNumber(kcalTarget)} kcal`}</Text>
          </Text>
          <Text variant="sub" tone={day.eaten.kcal > kcalTarget ? 'danger' : 'secondary'}>
            {left(kcalTarget, day.eaten.kcal, '')}
          </Text>
        </View>
        <ProgressBar
          progress={kcalTarget > 0 ? day.eaten.kcal / kcalTarget : 0}
          pace={hasPlan && kcalTarget > 0 ? Math.min(day.pace.kcal / kcalTarget, 1) : undefined}
          accent="calories"
          accessibilityLabel={`Calories ${day.eaten.kcal} of ${kcalTarget}`}
        />
        <View style={styles.row}>
          <Text variant="heading" tone="protein" num>
            {`${day.eaten.protein} g`}
            <Text variant="sub" tone="secondary" num>{` / ${proteinTarget} g protein`}</Text>
          </Text>
          <Text variant="sub" tone="secondary">
            {left(proteinTarget, day.eaten.protein, ' g')}
          </Text>
        </View>
        <ProgressBar
          progress={proteinTarget > 0 ? day.eaten.protein / proteinTarget : 0}
          pace={
            hasPlan && proteinTarget > 0 ? Math.min(day.pace.protein / proteinTarget, 1) : undefined
          }
          accent="protein"
          accessibilityLabel={`Protein ${day.eaten.protein} of ${proteinTarget} grams`}
        />
        <Text variant="caption" tone="secondary">
          {hasPlan
            ? `Tick = what the plan says you should have eaten by now (${formatIndianNumber(day.pace.kcal)} kcal · ${day.pace.protein} g).`
            : 'No plan, so no pace tick.'}
        </Text>
      </Card>
      {chips.map((c) => {
        const Icon = c.tone === 'danger' ? TriangleAlert : c.tone === 'warning' ? Zap : Info;
        return (
          <View
            key={c.id}
            testID={`insight-${c.id}`}
            accessible
            accessibilityLabel={c.text}
            style={[styles.chip, { backgroundColor: colors.raised, borderColor: colors.hairline }]}
          >
            <Icon size={16} color={toneColor(c.tone)} strokeWidth={2.2} />
            <Text variant="sub" style={styles.flex}>
              {c.text}
            </Text>
          </View>
        );
      })}
      {hasPlan ? (
        <View
          style={[
            styles.chip,
            { backgroundColor: colors.accents.success.tint, borderColor: colors.hairline },
          ]}
          accessible
          accessibilityLabel="Projection"
        >
          <Check size={16} color={colors.accents.success.base} strokeWidth={2.4} />
          <Text variant="sub" style={styles.flex} num>
            {`Rest of plan lands the day at ${formatIndianNumber(day.projected.kcal)} kcal · ${day.projected.protein} g.`}
          </Text>
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  flex: { flex: 1 },
});
