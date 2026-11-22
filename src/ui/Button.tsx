import type { LucideIcon } from 'lucide-react-native';
import { type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';

import { haptics } from './haptics';
import { PressableScale } from './PressableScale';
import { Text } from './Text';
import { useTheme } from './ThemeProvider';
import { TOUCH_MIN } from './theme';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'water' | 'destructive' | 'outline';
export type ButtonSize = 'sm' | 'md' | 'lg';

export type ButtonProps = {
  label: string;
  onPress: () => void;
  accessibilityLabel: string;
  accessibilityHint?: string;
  /** primary = the one "act now" action per screen (cobalt). */
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: LucideIcon;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const HEIGHT: Record<ButtonSize, number> = { sm: TOUCH_MIN, md: 48, lg: 52 };
const PAD: Record<ButtonSize, number> = { sm: 14, md: 18, lg: 22 };

export function Button({
  label,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  variant = 'primary',
  size = 'md',
  icon: Icon,
  disabled,
  fullWidth,
  style,
  testID,
}: ButtonProps) {
  const { colors, scheme } = useTheme();

  const look: Record<ButtonVariant, { bg: string; fg: string; border?: string }> = {
    primary: { bg: colors.buttonPrimary, fg: colors.onButton },
    secondary: { bg: colors.raised, fg: colors.text, border: colors.hairline },
    ghost: { bg: colors.ghost, fg: colors.accents.primary.text },
    water: { bg: colors.buttonWater, fg: colors.onButton },
    destructive: { bg: colors.buttonDestructive, fg: colors.onButton },
    outline: { bg: colors.raised, fg: colors.text, border: colors.border },
  };
  const { bg, fg, border } = look[variant];

  return (
    <PressableScale
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      disabled={disabled}
      onPress={() => {
        haptics.press();
        onPress();
      }}
      style={[
        styles.base,
        {
          height: HEIGHT[size],
          paddingHorizontal: PAD[size],
          backgroundColor: bg,
          borderColor: border ?? bg,
          borderWidth: border ? StyleSheet.hairlineWidth * 2 : 0,
          opacity: disabled ? 0.4 : 1,
        },
        variant === 'primary' &&
          !disabled && {
            shadowColor: colors.buttonPrimary,
            shadowOpacity: scheme === 'dark' ? 0.25 : 0.25,
            shadowRadius: 14,
            shadowOffset: { width: 0, height: 4 },
            elevation: 3,
          },
        fullWidth && styles.full,
        style,
      ]}
    >
      <View style={styles.row}>
        {Icon ? <Icon size={18} color={fg} strokeWidth={2.25} /> : null}
        <Text
          variant="button"
          style={[{ color: fg }, size === 'sm' && styles.small, size === 'lg' && styles.large]}
          numberOfLines={1}
        >
          {label}
        </Text>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    minWidth: TOUCH_MIN,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  full: { alignSelf: 'stretch' },
  small: { fontSize: 14 },
  large: { fontSize: 16 },
});
