import { Check } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { hhmm } from '@/features/routine/lib/blocks';
import { formatClock } from '@/lib/format';
import { Button, Chip, Sheet, Text, Toggle } from '@/ui';

import type { SkipReason } from '../selectors';

const REASONS: { value: SkipReason; label: string }[] = [
  { value: 'sick', label: 'Sick' },
  { value: 'travel', label: 'Travel' },
  { value: 'rest', label: 'Rest' },
  { value: 'other', label: 'Other' },
];

export type SkipSheetProps = {
  visible: boolean;
  onClose: () => void;
  title: string;
  startTime: string;
  durationMin: number;
  /** Already skipped: offer "Unskip". */
  skipped: boolean;
  initialReason?: SkipReason | null;
  optional: boolean;
  /** Workout blocks with a session that can move: "Upper A moves to Tue, …". */
  moveSummary: string | null;
  onSkip: (reason: SkipReason, moveToTomorrow: boolean) => void;
  onUnskip: () => void;
};

/** Sheet-SkipBlock design: reason chips, Move to tomorrow (workouts), Skip · Reason. */
export function SkipSheet(p: SkipSheetProps) {
  const [reason, setReason] = useState<SkipReason>(p.initialReason ?? 'sick');
  const [move, setMove] = useState(false);
  const label = REASONS.find((r) => r.value === reason)?.label ?? 'Other';
  return (
    <Sheet
      visible={p.visible}
      onClose={p.onClose}
      title={`Skip ${p.title}?`}
      subtitle={`${formatClock(hhmm(p.startTime))}${p.durationMin > 0 ? ` · ${p.durationMin} min` : ''}`}
      testID="skip-sheet"
    >
      <Text variant="sub" weight={600}>
        Reason
      </Text>
      <View style={styles.grid} accessibilityRole="radiogroup" accessibilityLabel="Reason">
        {REASONS.map((r) => (
          <View key={r.value} style={styles.cell}>
            <Chip
              label={r.label}
              selected={reason === r.value}
              leadingIcon={reason === r.value ? Check : undefined}
              accessibilityLabel={`Reason ${r.label}`}
              onPress={() => setReason(r.value)}
            />
          </View>
        ))}
      </View>
      {p.moveSummary ? (
        <Toggle
          label="Move to tomorrow"
          hint={p.moveSummary}
          value={move}
          onChange={setMove}
          testID="toggle-move"
        />
      ) : null}
      <Text variant="sub" tone="secondary">
        {p.optional
          ? 'Optional block: it never counts in the score.'
          : 'With a reason this block leaves today’s score, so the streak is safe.'}
      </Text>
      <Button
        label={`Skip · ${label}`}
        accessibilityLabel={`Skip, reason ${label}`}
        onPress={() => p.onSkip(reason, move)}
        fullWidth
        size="lg"
      />
      {p.skipped ? (
        <Button
          variant="outline"
          label="Unskip"
          accessibilityLabel="Unskip"
          onPress={p.onUnskip}
          fullWidth
        />
      ) : null}
      <Button
        variant="secondary"
        label="Cancel"
        accessibilityLabel="Cancel"
        onPress={p.onClose}
        fullWidth
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cell: { width: '48%' },
});
