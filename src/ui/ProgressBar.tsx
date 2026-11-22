import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { type LayoutChangeEvent, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { clamp01 } from './Ring';
import { Text } from './Text';
import { useTheme } from './ThemeProvider';
import { type Accent, motion, radius } from './theme';

export type ProgressBarProps = {
  /** 0–1 */
  progress: number;
  accent: Accent;
  accessibilityLabel: string;
  /** Row above the bar: label left, value right ("Water · 1,400 / 3,000 ml"). */
  label?: string;
  valueText?: string;
  /** 0–1 position of the "where you should be now" tick. */
  pace?: number;
  /** Text below the bar that says the gap. */
  caption?: string;
  captionTone?: 'secondary' | 'danger' | 'success';
  height?: number;
};

/** Two-tone fill with an optional breathing pace marker (Components-2). */
export function ProgressBar({
  progress,
  accent,
  accessibilityLabel,
  label,
  valueText,
  pace,
  caption,
  captionTone = 'secondary',
  height = 8,
}: ProgressBarProps) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const [trackWidth, setTrackWidth] = useState(0);
  const p = clamp01(progress);

  const width = useSharedValue(0);
  useEffect(() => {
    const target = trackWidth * p;
    width.value = reduceMotion
      ? target
      : withDelay(
          motion.barDelay,
          withTiming(target, { duration: motion.bar, easing: Easing.bezier(...motion.ease) }),
        );
  }, [p, reduceMotion, trackWidth, width]);
  const fillStyle = useAnimatedStyle(() => ({ width: width.value }));

  const breathe = useSharedValue(1);
  useEffect(() => {
    if (reduceMotion || pace === undefined) return;
    breathe.value = withDelay(
      motion.ring,
      withRepeat(
        withSequence(
          withTiming(0.35, { duration: motion.pace / 2 }),
          withTiming(1, { duration: motion.pace / 2 }),
        ),
        -1,
      ),
    );
  }, [breathe, pace, reduceMotion]);
  const paceStyle = useAnimatedStyle(() => ({ opacity: breathe.value }));

  const captionColor =
    captionTone === 'danger'
      ? colors.accents.danger.text
      : captionTone === 'success'
        ? colors.accents.success.text
        : colors.textSecondary;

  return (
    <View style={styles.wrap}>
      {label || valueText ? (
        <View style={styles.header}>
          {label ? (
            <Text variant="sub" weight={600}>
              {label}
            </Text>
          ) : (
            <View />
          )}
          {valueText ? (
            <Text variant="sub" tone="secondary" num>
              {valueText}
            </Text>
          ) : null}
        </View>
      ) : null}
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={accessibilityLabel}
        accessibilityValue={{ min: 0, max: 100, now: Math.round(p * 100) }}
        onLayout={(e: LayoutChangeEvent) => setTrackWidth(e.nativeEvent.layout.width)}
        style={[styles.track, { height, backgroundColor: colors.recessed }]}
      >
        <Animated.View testID="progress-fill" style={[styles.fill, { height }, fillStyle]}>
          <LinearGradient
            colors={colors.accents[accent].gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ height, width: trackWidth }}
          />
        </Animated.View>
        {pace !== undefined ? (
          <Animated.View
            testID="pace-marker"
            style={[
              styles.pace,
              {
                left: `${clamp01(pace) * 100}%`,
                top: -5,
                height: height + 10,
                backgroundColor: colors.text,
              },
              paceStyle,
            ]}
          />
        ) : null}
      </View>
      {caption ? (
        <Text variant="sub" num style={{ color: captionColor }}>
          {caption}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  track: { borderRadius: radius.pill, overflow: 'visible' },
  fill: { borderRadius: radius.pill, overflow: 'hidden' },
  pace: { position: 'absolute', width: 2, marginLeft: -1, borderRadius: 2 },
});
