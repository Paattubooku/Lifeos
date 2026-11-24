import { StyleSheet, View } from 'react-native';

import { istClock } from '@/lib/dates';
import { formatClock } from '@/lib/format';
import { Button, Card, Text } from '@/ui';

import { durationText, nightTimes, vsTarget } from '../lib/sleep';

/** "MORNING CHECK · 5:12 AM" (Prog-Sleep design); two taps: open app, Correct. */
export function MorningCheckCard({
  now,
  date,
  bed,
  wake,
  targetBed,
  onCorrect,
  onAdjust,
}: {
  now: number;
  date: string;
  bed: string;
  wake: string;
  targetBed: string;
  onCorrect: () => void;
  onAdjust: () => void;
}) {
  const { bedAt, wakeAt } = nightTimes(date, bed, wake);
  return (
    <Card kicker={`Morning check · ${formatClock(istClock(now))}`} testID="morning-check">
      <Text variant="heading">{`Went to bed ${formatClock(bed)}, woke ${formatClock(wake)}`}</Text>
      <Text variant="sub" tone="secondary">
        {`${durationText(bedAt, wakeAt)} · ${vsTarget(bed, targetBed, formatClock(targetBed))}.`}
      </Text>
      <View style={styles.row}>
        <Button
          label="Correct"
          accessibilityLabel={`Correct: bed ${formatClock(bed)}, woke ${formatClock(wake)}`}
          onPress={onCorrect}
          style={styles.flex}
          testID="night-correct"
        />
        <Button
          label="Adjust"
          variant="secondary"
          accessibilityLabel="Adjust bed and wake times"
          onPress={onAdjust}
          style={styles.flex}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10 },
  flex: { flex: 1 },
});
