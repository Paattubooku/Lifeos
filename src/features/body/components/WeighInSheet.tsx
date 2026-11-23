import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { shortDay } from '@/features/today/lib/present';
import { Button, Checkbox, Chip, NumberStepper, Sheet, Text } from '@/ui';

import { type AvgPoint, previewAvg, WEIGH_MAX, WEIGH_MIN } from '../lib/weight';

/** Prog-WeighIn design: stepper, ±0.1 / yesterday chips, weigh-in checklist (A20), live 7-day preview. */
export function WeighInSheet({
  today,
  points,
  initialKg,
  initialSalty,
  onSave,
  onClose,
}: {
  today: string;
  points: readonly AvgPoint[];
  initialKg: number;
  initialSalty: boolean;
  onSave: (kg: number, salty: boolean) => void;
  onClose: () => void;
}) {
  const [kg, setKg] = useState(Math.round(initialKg * 10) / 10);
  const [checks, setChecks] = useState({ toilet: true, scale: true, salty: initialSalty });
  const yesterday = [...points].reverse().find((p) => p.date < today);
  const preview = previewAvg(points, today, kg);
  const clamp = (v: number) => Math.min(WEIGH_MAX, Math.max(WEIGH_MIN, Math.round(v * 10) / 10));
  const fmt = (v: number) => (v > 0 ? `+${v}` : v === 0 ? '±0' : `−${Math.abs(v)}`);

  return (
    <Sheet
      visible
      onClose={onClose}
      title="Weigh-in"
      subtitle={`${shortDay(today)}${yesterday ? ` · last ${yesterday.weight} kg` : ''}`}
      testID="weighin-sheet"
    >
      <NumberStepper
        value={kg}
        onChange={setKg}
        accessibilityLabel="Weight"
        step={0.1}
        min={WEIGH_MIN}
        max={WEIGH_MAX}
        decimals={1}
        unit="kg"
      />
      <View style={styles.chips}>
        <Chip
          label="−0.1"
          accessibilityLabel="Minus 0.1 kilograms"
          onPress={() => setKg((v) => clamp(v - 0.1))}
        />
        {yesterday ? (
          <Chip
            label={`${yesterday.weight} (last)`}
            accessibilityLabel={`Use last weigh-in, ${yesterday.weight} kilograms`}
            onPress={() => setKg(yesterday.weight)}
          />
        ) : null}
        <Chip
          label="+0.1"
          accessibilityLabel="Plus 0.1 kilograms"
          onPress={() => setKg((v) => clamp(v + 0.1))}
        />
      </View>
      <View style={styles.checks}>
        {(
          [
            ['toilet', 'After toilet, before food or water'],
            ['scale', 'Same scale, same spot'],
            ['salty', 'After a salty or late dinner'],
          ] as const
        ).map(([key, label]) => (
          <View key={key} style={styles.check}>
            <Checkbox
              checked={checks[key]}
              onToggle={(v) => setChecks((c) => ({ ...c, [key]: v }))}
              accessibilityLabel={label}
            />
            <Text variant="body">{label}</Text>
          </View>
        ))}
      </View>
      <Text variant="caption" tone="secondary">
        {`7-day average becomes ${preview.avg7} kg${preview.change7 === null ? '' : ` (${fmt(preview.change7)} vs last week)`}. A salty dinner is marked on the chart.`}
      </Text>
      <Button
        label={`Save ${kg.toFixed(1)} kg`}
        accessibilityLabel={`Save ${kg.toFixed(1)} kilograms`}
        onPress={() => onSave(kg, checks.salty)}
        fullWidth
        size="lg"
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
  checks: { gap: 4 },
  check: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
