import type { LucideIcon } from 'lucide-react-native';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { haptics } from './haptics';
import { PressableScale } from './PressableScale';
import { Text } from './Text';
import { useTheme } from './ThemeProvider';
import { type Accent, motion, radius, TOUCH_MIN } from './theme';

export type ChipProps = {
  label: string;
  onPress: () => void;
  accessibilityLabel: string;
  selected?: boolean;
  /** Icon before the label (e.g. Check on a selected reason). */
  leadingIcon?: LucideIcon;
  /** Icon after the label (e.g. ChevronDown on the template chip). */
  trailingIcon?: LucideIcon;
  testID?: string;
};

/** Tappable pill, 44 tall. Selected = cobalt fill. */
export function Chip({
  label,
  onPress,
  accessibilityLabel,
  selected,
  leadingIcon: Lead,
  trailingIcon: Trail,
  testID,
}: ChipProps) {
  const { colors } = useTheme();
  const fg = selected ? colors.onButton : colors.text;
  return (
    <PressableScale
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected: !!selected }}
      onPress={() => {
        haptics.tap();
        onPress();
      }}
      style={[
        styles.chip,
        selected
          ? { backgroundColor: colors.buttonPrimary, borderColor: colors.buttonPrimary }
          : { backgroundColor: colors.raised, borderColor: colors.hairline },
      ]}
    >
      {Lead ? <Lead size={16} color={fg} strokeWidth={2.25} /> : null}
      <Text variant="sub" weight={500} style={{ color: fg }}>
        {label}
      </Text>
      {Trail ? <Trail size={16} color={fg} strokeWidth={2.25} /> : null}
    </PressableScale>
  );
}

export type StatusTone = Accent | 'neutral';

export type StatusChipProps = {
  label: string;
  tone?: StatusTone;
  /** 6 px pulsing dot ("NOW", live chips). */
  beacon?: boolean;
};

/** Read-only status pill: 12% tint + saturated text, 24 tall. */
export function StatusChip({ label, tone = 'neutral', beacon }: StatusChipProps) {
  const { colors } = useTheme();
  const bg = tone === 'neutral' ? colors.recessed : colors.accents[tone].tint;
  const fg = tone === 'neutral' ? colors.text : colors.accents[tone].text;
  return (
    <View accessible accessibilityLabel={label} style={[styles.status, { backgroundColor: bg }]}>
      {beacon ? <Beacon color={fg} /> : null}
      <Text variant="caption" weight={600} num style={{ color: fg }}>
        {label}
      </Text>
    </View>
  );
}

function Beacon({ color }: { color: string }) {
  const reduceMotion = useReducedMotion();
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) return;
    pulse.value = withRepeat(
      withTiming(1, { duration: motion.beacon, easing: Easing.out(Easing.quad) }),
      -1,
      false,
    );
  }, [pulse, reduceMotion]);
  const ring = useAnimatedStyle(() => ({
    opacity: 0.6 * (1 - pulse.value),
    transform: [{ scale: 1 + pulse.value * 2 }],
  }));
  return (
    <View style={styles.beaconWrap}>
      <Animated.View style={[styles.beacon, { backgroundColor: color }, ring]} />
      <View style={[styles.beacon, { backgroundColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: TOUCH_MIN,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  status: {
    height: 24,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
  },
  beaconWrap: { width: 6, height: 6 },
  beacon: { position: 'absolute', width: 6, height: 6, borderRadius: 3 },
});
