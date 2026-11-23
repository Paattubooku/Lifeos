import { Minus, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { Button, PressableScale, Text, TOUCH_MIN, useTheme, fonts } from '@/ui';

import { MAX_ENTRY_ML, validateAmount } from '../lib/pace';

const STEP = 50;

/** − [ 350 ] ml + Add — 50 ml steps, or type any amount (1–2,000 ml, inline error). */
export function CustomAmount({
  initial = 350,
  onAdd,
  addLabel = () => 'Add',
  fullWidthAdd = false,
}: {
  initial?: number;
  onAdd: (ml: number) => void;
  addLabel?: (ml: number) => string;
  fullWidthAdd?: boolean;
}) {
  const { colors } = useTheme();
  const [text, setText] = useState(String(initial));
  const value = text.trim() === '' ? Number.NaN : Number(text);
  const error = validateAmount(value);
  const step = (dir: 1 | -1) => {
    const base = Number.isFinite(value) ? value : initial;
    const next = Math.min(
      MAX_ENTRY_ML,
      Math.max(STEP, Math.round((base + dir * STEP) / STEP) * STEP),
    );
    setText(String(next));
  };
  const control = (dir: 1 | -1) => (
    <PressableScale
      accessibilityLabel={dir === 1 ? 'Increase custom amount' : 'Decrease custom amount'}
      onPress={() => step(dir)}
      style={[styles.control, { borderColor: colors.hairline, backgroundColor: colors.raised }]}
    >
      {dir === 1 ? (
        <Plus size={20} color={colors.text} strokeWidth={2} />
      ) : (
        <Minus size={20} color={colors.text} strokeWidth={2} />
      )}
    </PressableScale>
  );
  const add = (
    <Button
      variant="water"
      label={addLabel(Number.isFinite(value) ? value : 0)}
      accessibilityLabel={`Add ${Number.isFinite(value) ? value : 0} ml`}
      disabled={error !== null}
      onPress={() => onAdd(value)}
      fullWidth={fullWidthAdd}
    />
  );
  return (
    <View style={styles.wrap}>
      <View
        style={[
          styles.row,
          fullWidthAdd ? { backgroundColor: colors.recessed, borderRadius: 16, padding: 6 } : null,
        ]}
      >
        {control(-1)}
        <View style={styles.value}>
          <TextInput
            accessibilityLabel="Custom amount in ml"
            value={text}
            onChangeText={(t) => setText(t.replace(/[^0-9.]/g, ''))}
            keyboardType="number-pad"
            maxLength={5}
            selectTextOnFocus
            style={[styles.input, { color: colors.text, fontFamily: fonts.display[700] }]}
          />
          <Text variant="caption" tone="secondary">
            ml
          </Text>
        </View>
        {control(1)}
        {fullWidthAdd ? null : add}
      </View>
      {error ? (
        <Text variant="caption" tone="danger" testID="amount-error">
          {error}
        </Text>
      ) : null}
      {fullWidthAdd ? add : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  control: {
    width: TOUCH_MIN,
    height: TOUCH_MIN,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: 3,
  },
  input: { fontSize: 28, minWidth: 64, textAlign: 'center', padding: 0 },
});
