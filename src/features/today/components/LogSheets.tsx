import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { formatDuration } from '@/features/profile/lib/targets';
import { Button, NumberStepper, Sheet, Text, TextField, TimePicker } from '@/ui';

type Base = { visible: boolean; onClose: () => void };

/** Today's weight (F13 adds trends; this is the end-of-day quick log). */
export function WeightSheet(p: Base & { initialKg: number; onSave: (kg: number) => void }) {
  const [kg, setKg] = useState(p.initialKg);
  return (
    <Sheet
      visible={p.visible}
      onClose={p.onClose}
      title="Log weight"
      subtitle="Today, after the toilet, same scale."
      testID="weight-sheet"
    >
      <NumberStepper
        value={kg}
        onChange={setKg}
        accessibilityLabel="Weight"
        step={0.1}
        min={20}
        max={300}
        decimals={1}
        unit="kg"
      />
      <Button
        label="Save weight"
        accessibilityLabel="Save weight"
        onPress={() => p.onSave(kg)}
        fullWidth
        size="lg"
      />
    </Sheet>
  );
}

/** Last night: bed and wake times (F14 builds the full sleep screen). */
export function SleepSheet(
  p: Base & {
    initialBed: string;
    initialWake: string;
    onSave: (bed: string, wake: string) => void;
  },
) {
  const [bed, setBed] = useState(p.initialBed);
  const [wake, setWake] = useState(p.initialWake);
  const minutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  const night = (minutes(wake) - minutes(bed) + 1440) % 1440;
  const error = night < 60 ? 'Bed and wake times look wrong.' : null;
  return (
    <Sheet
      visible={p.visible}
      onClose={p.onClose}
      title="Log sleep"
      subtitle="Last night"
      testID="sleep-sheet"
    >
      <View style={styles.cols}>
        <View style={styles.col}>
          <Text variant="sub" weight={600}>
            Bed
          </Text>
          <TimePicker value={bed} onChange={setBed} accessibilityLabel="Bed" minuteStep={5} />
        </View>
        <View style={styles.col}>
          <Text variant="sub" weight={600}>
            Woke
          </Text>
          <TimePicker value={wake} onChange={setWake} accessibilityLabel="Woke" minuteStep={5} />
        </View>
      </View>
      <Text variant="sub" tone={error ? 'danger' : 'secondary'}>
        {error ?? `${formatDuration(night)} of sleep`}
      </Text>
      <Button
        label="Save sleep"
        accessibilityLabel="Save sleep"
        disabled={error !== null}
        onPress={() => p.onSave(bed, wake)}
        fullWidth
        size="lg"
      />
    </Sheet>
  );
}

export function NoteSheet(p: Base & { initial: string; onSave: (note: string) => void }) {
  const [note, setNote] = useState(p.initial);
  return (
    <Sheet visible={p.visible} onClose={p.onClose} title="Today’s note" testID="note-sheet">
      <TextField
        label="Note"
        value={note}
        onChangeText={setNote}
        multiline
        maxLength={500}
        placeholder="What helped, what didn’t"
      />
      <Button
        label="Save note"
        accessibilityLabel="Save note"
        onPress={() => p.onSave(note)}
        fullWidth
        size="lg"
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  cols: { flexDirection: 'row', gap: 12 },
  col: { flex: 1, gap: 8 },
});
