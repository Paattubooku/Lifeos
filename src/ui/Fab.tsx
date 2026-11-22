import { Droplet } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { haptics } from './haptics';
import { Text } from './Text';
import { useTheme } from './ThemeProvider';
import { motion } from './theme';

export type FabProps = {
  /** Tap: +200 ml (F07 wires the action). */
  onPress: () => void;
  /** Hold: opens the 500 / 750 / custom sheet. */
  onLongPress: () => void;
  label?: string;
  accessibilityLabel?: string;
  testID?: string;
};

const SIZE = 60;

/** Global water FAB: sky ripple invites the tap; long-press shows a 6 px halo + haptic. */
export function Fab({
  onPress,
  onLongPress,
  label = '+200',
  accessibilityLabel = 'Add 200 ml water. Long-press for 500, 750 or custom.',
  testID,
}: FabProps) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const [holding, setHolding] = useState(false);

  const ripple = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) return;
    ripple.value = withDelay(
      1000,
      withRepeat(
        withTiming(1, { duration: motion.fabRipple, easing: Easing.out(Easing.quad) }),
        -1,
        false,
      ),
    );
  }, [reduceMotion, ripple]);
  const rippleStyle = useAnimatedStyle(() => {
    // Expands 14 px over the first 70% of the cycle, then rests.
    const t = Math.min(ripple.value / 0.7, 1);
    return { opacity: 0.45 * (1 - t), transform: [{ scale: 1 + (t * 28) / SIZE }] };
  });

  return (
    <View style={styles.wrap}>
      <Animated.View
        pointerEvents="none"
        style={[styles.ring, { backgroundColor: colors.buttonWater }, rippleStyle]}
      />
      {holding ? (
        <View
          testID="fab-halo"
          pointerEvents="none"
          style={[styles.halo, { backgroundColor: colors.accents.water.tint }]}
        />
      ) : null}
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityActions={[{ name: 'longpress', label: 'More amounts' }]}
        onAccessibilityAction={(e) => {
          if (e.nativeEvent.actionName === 'longpress') onLongPress();
        }}
        delayLongPress={350}
        onPress={() => {
          haptics.press();
          onPress();
        }}
        onLongPress={() => {
          haptics.hold();
          setHolding(true);
          onLongPress();
        }}
        onPressOut={() => setHolding(false)}
        style={({ pressed }) => [
          styles.fab,
          {
            backgroundColor: colors.buttonWater,
            shadowColor: colors.buttonWater,
            transform: [{ scale: holding ? 1.04 : pressed && !reduceMotion ? motion.press : 1 }],
          },
        ]}
      >
        <Droplet size={20} color={colors.onButton} strokeWidth={2.25} />
        <Text variant="kicker" weight={700} tone="onButton" num>
          {label}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: SIZE, height: SIZE, borderRadius: SIZE / 2 },
  halo: {
    position: 'absolute',
    width: SIZE + 12,
    height: SIZE + 12,
    borderRadius: (SIZE + 12) / 2,
  },
  fab: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.45,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
});
