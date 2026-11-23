import { type ReactNode, useEffect, useId } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, Line, LinearGradient, Stop } from 'react-native-svg';

import { useTheme } from './ThemeProvider';
import { type Accent, motion } from './theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export type RingSpec = { progress: number; accent: Accent };

export type RingProps = {
  /** 0–1 (values outside are clamped). */
  progress: number;
  accent: Accent;
  size?: number;
  strokeWidth?: number;
  /** Centre content (value + unit). */
  children?: ReactNode;
  /** e.g. "Routine 45 percent". */
  accessibilityLabel: string;
  /** 0–1: a white tick across the ring (e.g. water pace for now). */
  marker?: number;
};

export type TripleRingProps = {
  /** Outer → inner, e.g. routine / water / protein. */
  rings: readonly [RingSpec, RingSpec, RingSpec];
  size?: number;
  strokeWidth?: number;
  gap?: number;
  children?: ReactNode;
  accessibilityLabel: string;
};

export const clamp01 = (n: number) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);

/** Single metric ring: #track, round caps, two-tone gradient stroke, draws in over 1.4 s. */
export function Ring({
  progress,
  accent,
  size = 72,
  strokeWidth = 8,
  children,
  accessibilityLabel,
  marker,
}: RingProps) {
  return (
    <RingFrame
      size={size}
      accessibilityLabel={accessibilityLabel}
      progress={progress}
      center={children}
    >
      <Arc
        size={size}
        strokeWidth={strokeWidth}
        inset={0}
        spec={{ progress, accent }}
        delay={150}
      />
      {marker === undefined ? null : <Tick size={size} strokeWidth={strokeWidth} at={marker} />}
    </RingFrame>
  );
}

/** Day score ring: three concentric arcs, staggered 150 ms. */
export function TripleRing({
  rings,
  size = 152,
  strokeWidth = 10,
  gap = 4,
  children,
  accessibilityLabel,
}: TripleRingProps) {
  return (
    <RingFrame
      size={size}
      accessibilityLabel={accessibilityLabel}
      progress={rings[0].progress}
      center={children}
    >
      {rings.map((spec, i) => (
        <Arc
          key={i}
          size={size}
          strokeWidth={strokeWidth}
          inset={i * (strokeWidth + gap)}
          spec={spec}
          delay={150 * (i + 1)}
        />
      ))}
    </RingFrame>
  );
}

function RingFrame({
  size,
  progress,
  accessibilityLabel,
  center,
  children,
}: {
  size: number;
  progress: number;
  accessibilityLabel: string;
  center?: ReactNode;
  children: ReactNode;
}) {
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamp01(progress) * 100) }}
      style={{ width: size, height: size }}
    >
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {children}
      </Svg>
      {center ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <View style={styles.center}>{center}</View>
        </View>
      ) : null}
    </View>
  );
}

function Arc({
  size,
  strokeWidth,
  inset,
  spec,
  delay,
}: {
  size: number;
  strokeWidth: number;
  inset: number;
  spec: RingSpec;
  delay: number;
}) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const gradientId = `ring${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const r = (size - strokeWidth) / 2 - inset;
  const c = 2 * Math.PI * r;
  const target = c * (1 - clamp01(spec.progress));
  const offset = useSharedValue(reduceMotion ? target : c);

  useEffect(() => {
    offset.value = reduceMotion
      ? target
      : withDelay(
          delay,
          withTiming(target, { duration: motion.ring, easing: Easing.bezier(...motion.ease) }),
        );
  }, [delay, offset, reduceMotion, target]);

  const animatedProps = useAnimatedProps(() => ({ strokeDashoffset: offset.value }));
  const [from, to] = colors.accents[spec.accent].gradient;
  const mid = size / 2;

  return (
    <>
      <Defs>
        <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={from} />
          <Stop offset="1" stopColor={to} />
        </LinearGradient>
      </Defs>
      <Circle
        cx={mid}
        cy={mid}
        r={r}
        fill="none"
        stroke={colors.ringTrack}
        strokeWidth={strokeWidth}
      />
      <AnimatedCircle
        cx={mid}
        cy={mid}
        r={r}
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={`${c} ${c}`}
        animatedProps={animatedProps}
        transform={`rotate(-90 ${mid} ${mid})`}
      />
    </>
  );
}

/** Radial tick at `at` (0–1, clockwise from 12 o'clock) across the ring. */
function Tick({ size, strokeWidth, at }: { size: number; strokeWidth: number; at: number }) {
  const { colors } = useTheme();
  const mid = size / 2;
  const r = (size - strokeWidth) / 2;
  const angle = clamp01(at) * 2 * Math.PI - Math.PI / 2;
  const inner = r - strokeWidth / 2 - 4;
  const outer = r + strokeWidth / 2 + 2;
  return (
    <Line
      testID="ring-marker"
      x1={mid + inner * Math.cos(angle)}
      y1={mid + inner * Math.sin(angle)}
      x2={mid + Math.min(outer, mid - 1) * Math.cos(angle)}
      y2={mid + Math.min(outer, mid - 1) * Math.sin(angle)}
      stroke={colors.text}
      strokeWidth={3}
      strokeLinecap="round"
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
