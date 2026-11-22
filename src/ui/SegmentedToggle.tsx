import { Pressable, StyleSheet, View } from 'react-native';

import { haptics } from './haptics';
import { Text } from './Text';
import { useTheme } from './ThemeProvider';
import { cardShadow, radius } from './theme';

export type SegmentOption<T extends string> = { value: T; label: string };

export type SegmentedToggleProps<T extends string> = {
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Describes the group, e.g. "Template". */
  accessibilityLabel: string;
  testID?: string;
};

/** Recessed pill rail, 4 px inset; the active segment lifts as a raised chip. */
export function SegmentedToggle<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
  testID,
}: SegmentedToggleProps<T>) {
  const { colors, scheme } = useTheme();
  return (
    <View
      testID={testID}
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      style={[styles.rail, { backgroundColor: colors.recessed }]}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            accessibilityRole="radio"
            accessibilityLabel={opt.label}
            accessibilityState={{ checked: active, selected: active }}
            hitSlop={2}
            onPress={() => {
              if (active) return;
              haptics.tap();
              onChange(opt.value);
            }}
            style={[
              styles.segment,
              active && [
                { backgroundColor: colors.raised, borderColor: colors.hairline, borderWidth: 1 },
                cardShadow(scheme),
              ],
            ]}
          >
            <Text
              variant="sub"
              weight={active ? 600 : 500}
              tone={active ? 'default' : 'secondary'}
              numberOfLines={1}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  rail: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: radius.pill },
  segment: {
    flex: 1,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
});
