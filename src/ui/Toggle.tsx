import { StyleSheet, Switch, View } from 'react-native';

import { haptics } from './haptics';
import { Text } from './Text';
import { useTheme } from './ThemeProvider';

export type ToggleProps = {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  testID?: string;
};

/** Settings row: label + hint left, switch right (Block edit "Notify at start"). */
export function Toggle({ label, hint, value, onChange, disabled, testID }: ToggleProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <View style={styles.text}>
        <Text variant="body" weight={600}>
          {label}
        </Text>
        {hint ? (
          <Text variant="caption" tone="secondary">
            {hint}
          </Text>
        ) : null}
      </View>
      <Switch
        testID={testID}
        accessibilityLabel={label}
        accessibilityHint={hint}
        value={value}
        disabled={disabled}
        onValueChange={(v) => {
          haptics.tap();
          onChange(v);
        }}
        trackColor={{ false: colors.recessed, true: colors.buttonPrimary }}
        thumbColor={colors.onButton}
        ios_backgroundColor={colors.recessed}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 },
  text: { flex: 1, minWidth: 0, gap: 2 },
});
