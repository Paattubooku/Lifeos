import { Minus, Plus } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { haptics } from './haptics';
import { nextStepValue, type StepRule } from './NumberStepper';
import { PressableScale } from './PressableScale';
import { Text } from './Text';
import { useTheme } from './ThemeProvider';
import { radius, TOUCH_MIN } from './theme';

export type InlineStepperProps = {
  label: string;
  hint?: string;
  value: number;
  onChange: (value: number) => void;
  step?: StepRule;
  min?: number;
  max?: number;
  unit?: string;
  decimals?: number;
  /** Custom display (e.g. Indian grouping "3,000"). */
  format?: (value: number) => string;
  testID?: string;
};

/** Settings-style row: label + hint left, − value + right (Onboarding 1 & 3 designs). */
export function InlineStepper({
  label,
  hint,
  value,
  onChange,
  step = 1,
  min = -Infinity,
  max = Infinity,
  unit,
  decimals = 0,
  format,
  testID,
}: InlineStepperProps) {
  const { colors } = useTheme();
  const display = format ? format(value) : value.toFixed(decimals);
  const valueText = unit ? `${display} ${unit}` : display;

  const change = (direction: 1 | -1) => {
    const next = nextStepValue(value, direction, { step, min, max, decimals });
    if (next !== value) {
      haptics.tap();
      onChange(next);
    }
  };

  const control = (direction: 1 | -1) => {
    const enabled = direction === 1 ? value < max : value > min;
    const Icon = direction === 1 ? Plus : Minus;
    return (
      <PressableScale
        accessibilityLabel={`${direction === 1 ? 'Increase' : 'Decrease'} ${label}`}
        disabled={!enabled}
        onPress={() => change(direction)}
        style={[
          styles.control,
          {
            borderColor: colors.hairline,
            backgroundColor: colors.raised,
            opacity: enabled ? 1 : 0.4,
          },
        ]}
      >
        <Icon size={20} color={colors.text} strokeWidth={2} />
      </PressableScale>
    );
  };

  return (
    <View testID={testID} style={styles.row}>
      <View style={styles.label}>
        <Text variant="body" weight={600}>
          {label}
        </Text>
        {hint ? (
          <Text variant="caption" tone="secondary">
            {hint}
          </Text>
        ) : null}
      </View>
      <View
        style={styles.controls}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={{ text: valueText }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => change(e.nativeEvent.actionName === 'increment' ? 1 : -1)}
      >
        {control(-1)}
        <View style={styles.value}>
          <Text variant="heading" num>
            {display}
          </Text>
          {unit ? (
            <Text variant="caption" tone="secondary">
              {unit}
            </Text>
          ) : null}
        </View>
        {control(1)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12 },
  label: { flex: 1, minWidth: 0, gap: 2 },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  control: {
    width: TOUCH_MIN,
    height: TOUCH_MIN,
    borderRadius: radius.button,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    minWidth: 92,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: 3,
  },
});
