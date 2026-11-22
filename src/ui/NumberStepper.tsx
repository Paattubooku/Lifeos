import { Minus, Plus } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { haptics } from './haptics';
import { PressableScale } from './PressableScale';
import { Text } from './Text';
import { useTheme } from './ThemeProvider';
import { radius } from './theme';

/** Step size: fixed, or a function (e.g. 0.5 kg below 10 kg, 1 kg above — F11). */
export type StepRule = number | ((value: number, direction: 1 | -1) => number);

export type NumberStepperProps = {
  value: number;
  onChange: (value: number) => void;
  /** What is being changed, e.g. "Water amount". */
  accessibilityLabel: string;
  step?: StepRule;
  min?: number;
  max?: number;
  unit?: string;
  decimals?: number;
  testID?: string;
};

/** Pure: next value after one press, clamped and rounded to `decimals`. */
export function nextStepValue(
  value: number,
  direction: 1 | -1,
  {
    step = 1,
    min = -Infinity,
    max = Infinity,
    decimals = 0,
  }: Pick<NumberStepperProps, 'step' | 'min' | 'max' | 'decimals'>,
): number {
  const size = typeof step === 'function' ? step(value, direction) : step;
  const raw = value + direction * size;
  const factor = 10 ** decimals;
  const rounded = Math.round(raw * factor) / factor;
  return Math.min(max, Math.max(min, rounded));
}

/** Recessed rail with inset 48 px − / + controls and a tabular value. */
export function NumberStepper({
  value,
  onChange,
  accessibilityLabel,
  step = 1,
  min = -Infinity,
  max = Infinity,
  unit,
  decimals = 0,
  testID,
}: NumberStepperProps) {
  const { colors } = useTheme();
  const display = value.toFixed(decimals);
  const valueText = unit ? `${display} ${unit}` : display;
  const canDec = value > min;
  const canInc = value < max;

  const change = (direction: 1 | -1) => {
    const next = nextStepValue(value, direction, { step, min, max, decimals });
    if (next !== value) {
      haptics.tap();
      onChange(next);
    }
  };

  const control = (direction: 1 | -1) => {
    const Icon = direction === 1 ? Plus : Minus;
    const enabled = direction === 1 ? canInc : canDec;
    return (
      <PressableScale
        accessibilityLabel={
          direction === 1 ? `Increase ${accessibilityLabel}` : `Decrease ${accessibilityLabel}`
        }
        disabled={!enabled}
        onPress={() => change(direction)}
        style={[
          styles.control,
          {
            backgroundColor: colors.raised,
            borderColor: colors.hairline,
            opacity: enabled ? 1 : 0.4,
          },
        ]}
      >
        <Icon size={20} color={colors.text} strokeWidth={2.25} />
      </PressableScale>
    );
  };

  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ text: valueText }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => change(e.nativeEvent.actionName === 'increment' ? 1 : -1)}
      style={[styles.rail, { backgroundColor: colors.recessed }]}
    >
      {control(-1)}
      <View style={styles.value}>
        <Text variant="metric" num>
          {display}
        </Text>
        {unit ? (
          <Text variant="caption" tone="secondary" style={styles.unit}>
            {unit}
          </Text>
        ) : null}
      </View>
      {control(1)}
    </View>
  );
}

const styles = StyleSheet.create({
  rail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 4,
    borderRadius: radius.card,
  },
  control: {
    width: 48,
    height: 48,
    borderRadius: radius.button,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: 4,
  },
  unit: { fontSize: 13 },
});
