import { Check, Droplet } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { hhmm } from '@/features/routine/lib/blocks';
import { formatClock } from '@/lib/format';
import { Button, Card, Text, useTheme } from '@/ui';

import { drinkAmount } from '../lib/auto';
import { type RowContext, rowText, rowTitle } from '../lib/present';
import { endOf, formatMinutes, startOf } from '../lib/timeline';
import type { DayRow } from '../selectors';

export type NowCardProps = {
  current: DayRow | null;
  next: DayRow | null;
  ctx: RowContext;
  /** Is `current` the day's last water block (the water target)? */
  isWaterTarget: boolean;
  onDone: (row: DayRow) => void;
  onSkip: (row: DayRow) => void;
  onLogWater: (ml: number) => void;
};

const clockOf = (min: number) => {
  const m = ((min % 1440) + 1440) % 1440;
  return formatClock(
    `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`,
  );
};

/** The highlighted "NOW" block with its one action, or what's next (Today designs). */
export function NowCard({
  current,
  next,
  ctx,
  isWaterTarget,
  onDone,
  onSkip,
  onLogWater,
}: NowCardProps) {
  const { colors } = useTheme();
  if (!current) {
    if (!next) return null;
    return (
      <Card testID="next-card">
        <View style={styles.top}>
          <Text variant="kicker" tone="secondary">
            {`Next · ${formatClock(hhmm(next.block.start_time))}`}
          </Text>
          <Text variant="sub" tone="primary" num>
            {`in ${formatMinutes(startOf(next.block) - ctx.nowMin)}`}
          </Text>
        </View>
        <Text variant="heading">{rowTitle(next, ctx.session)}</Text>
        <Text variant="sub" tone="secondary">
          {rowText(next, ctx, true).sub}
        </Text>
      </Card>
    );
  }

  const b = current.block;
  const title = rowTitle(current, ctx.session);
  const drink =
    b.kind === 'water' && b.auto_complete && !isWaterTarget ? drinkAmount(b.title) : null;
  return (
    <Card testID="now-card" style={{ borderColor: colors.accents.primary.base, borderWidth: 1.5 }}>
      <View style={styles.top}>
        <View style={[styles.chip, { backgroundColor: colors.buttonPrimary }]}>
          <Text variant="caption" weight={700} tone="onButton">
            {`NOW · ${formatClock(hhmm(b.start_time)).toUpperCase()}`}
          </Text>
        </View>
        <Text variant="sub" tone="primary" weight={700}>
          {`until ${clockOf(endOf(b))}`}
        </Text>
      </View>
      <Text variant="title" style={styles.title}>
        {title}
      </Text>
      <Text variant="sub" tone="secondary">
        {rowText({ ...current, state: 'upcoming' }, ctx, false).sub}
      </Text>
      <View style={styles.actions}>
        {drink ? (
          <Button
            variant="water"
            icon={Droplet}
            label={`Log ${drink} ml`}
            accessibilityLabel={`Log ${drink} ml of water`}
            onPress={() => onLogWater(drink)}
            style={styles.flex}
          />
        ) : (
          <Button
            icon={Check}
            label="Mark done"
            accessibilityLabel={`Mark ${title} done`}
            onPress={() => onDone(current)}
            style={styles.flex}
          />
        )}
        <Button
          variant="secondary"
          label="Skip"
          accessibilityLabel={`Skip ${title}`}
          onPress={() => onSkip(current)}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  title: { marginTop: 2 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  flex: { flex: 1 },
});
