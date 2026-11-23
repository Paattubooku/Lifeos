import { Undo2 } from 'lucide-react-native';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  type EntryAnimationsValues,
  type ExitAnimationsValues,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { Text } from './Text';
import { useTheme } from './ThemeProvider';
import { motion, radius } from './theme';

export type SnackbarProps = {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

/** Same no-bounce spring as Sheet: settles without overshoot. */
const SETTLE = { damping: 30, stiffness: 340, mass: 0.9, overshootClamping: true } as const;
/** Swipe this far sideways (or flick) to dismiss. */
const SWIPE_DISMISS = 90;

/** Rise 16 px, fade and grow from 96 % (custom Reanimated entering animation). */
export function snackbarEnter(_values: EntryAnimationsValues) {
  'worklet';
  return {
    initialValues: { opacity: 0, transform: [{ translateY: 16 }, { scale: 0.96 }] },
    animations: {
      opacity: withTiming(1, { duration: 160 }),
      transform: [{ translateY: withSpring(0, SETTLE) }, { scale: withSpring(1, SETTLE) }],
    },
  };
}

/** Quick fade with a small drop. */
export function snackbarExit(_values: ExitAnimationsValues) {
  'worklet';
  const ease = { duration: 180, easing: Easing.in(Easing.cubic) };
  return {
    initialValues: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }] },
    animations: {
      opacity: withTiming(0, ease),
      transform: [{ translateY: withTiming(10, ease) }, { scale: withTiming(0.98, ease) }],
    },
  };
}

/** Thin line along the bottom that runs out with the Undo window. */
function Countdown({ duration }: { duration: number }) {
  const { colors } = useTheme();
  const left = useSharedValue(1);
  useEffect(() => {
    left.set(withTiming(0, { duration, easing: Easing.linear }));
  }, [duration, left]);
  const style = useAnimatedStyle(() => ({ width: `${left.get() * 100}%` }));
  return (
    <View style={styles.track} pointerEvents="none" testID="snackbar-countdown">
      <Animated.View style={[styles.line, { backgroundColor: colors.inverseAction }, style]} />
    </View>
  );
}

/** Inverted pill: message + optional Undo (+ the countdown line while Undo is open). */
export function Snackbar({
  message,
  actionLabel,
  onAction,
  duration,
}: SnackbarProps & { duration?: number }) {
  const { colors } = useTheme();
  return (
    <View
      accessibilityLiveRegion="polite"
      style={[styles.bar, { backgroundColor: colors.inverseSurface }]}
    >
      <Text variant="sub" weight={500} num tone="onInverse" style={styles.message}>
        {message}
      </Text>
      {actionLabel && onAction ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${actionLabel}: ${message}`}
          onPress={onAction}
          style={({ pressed }) => [styles.action, pressed ? styles.pressed : null]}
        >
          <Undo2 size={16} color={colors.inverseAction} strokeWidth={2.25} />
          <Text variant="sub" weight={700} style={{ color: colors.inverseAction }}>
            {actionLabel}
          </Text>
        </Pressable>
      ) : null}
      {duration && actionLabel && onAction ? <Countdown duration={duration} /> : null}
    </View>
  );
}

export type ShowSnackbar = (options: SnackbarProps & { duration?: number }) => void;

const SnackbarContext = createContext<ShowSnackbar>(() => undefined);

type Current = SnackbarProps & { id: number; duration: number };

/**
 * Hosts one snackbar at a time above the tab bar. `useSnackbar()` returns `show`.
 * Every destructive action shows one with Undo for 5 s (PRD §4.5).
 */
export function SnackbarProvider({
  children,
  bottomOffset = 104,
}: {
  children: ReactNode;
  bottomOffset?: number;
}) {
  const [current, setCurrent] = useState<Current | null>(null);
  const reduceMotion = useReducedMotion();
  const swipe = useSharedValue(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextId = useRef(1);

  const clear = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const show = useCallback<ShowSnackbar>(
    ({ duration = motion.snackbar, ...props }) => {
      clear();
      swipe.set(0);
      setCurrent({ ...props, duration, id: nextId.current++ });
      AccessibilityInfo.announceForAccessibility(props.message);
      timer.current = setTimeout(() => setCurrent(null), duration);
    },
    [clear, swipe],
  );

  useEffect(() => clear, [clear]);

  // Swiped away (or replaced by nothing): stop the hide timer.
  useEffect(() => {
    if (!current) clear();
  }, [current, clear]);
  const dismiss = () => setCurrent(null);
  const pan = Gesture.Pan()
    .withTestId('snackbar-swipe')
    .activeOffsetX([-12, 12])
    .failOffsetY([-12, 12])
    .onUpdate((e) => {
      swipe.set(e.translationX);
    })
    .onEnd((e) => {
      if (Math.abs(e.translationX) > SWIPE_DISMISS || Math.abs(e.velocityX) > 800) {
        const away = Math.sign(e.translationX || e.velocityX) * 480;
        swipe.set(
          withTiming(away, { duration: 160 }, (done) => {
            if (done) scheduleOnRN(dismiss);
          }),
        );
      } else {
        swipe.set(withSpring(0, SETTLE));
      }
    });
  const swipeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: swipe.get() }],
    opacity: 1 - Math.min(Math.abs(swipe.get()) / 240, 0.7),
  }));

  const value = useMemo(() => show, [show]);

  return (
    <SnackbarContext.Provider value={value}>
      {children}
      {current ? (
        <Animated.View
          key={current.id}
          entering={reduceMotion ? undefined : snackbarEnter}
          exiting={reduceMotion ? undefined : snackbarExit}
          style={[styles.host, { bottom: bottomOffset }]}
          pointerEvents="box-none"
        >
          <GestureDetector gesture={pan}>
            <Animated.View style={swipeStyle}>
              <Snackbar
                message={current.message}
                duration={reduceMotion ? undefined : current.duration}
                actionLabel={current.actionLabel}
                onAction={
                  current.onAction
                    ? () => {
                        clear();
                        setCurrent(null);
                        current.onAction?.();
                      }
                    : undefined
                }
              />
            </Animated.View>
          </GestureDetector>
        </Animated.View>
      ) : null}
    </SnackbarContext.Provider>
  );
}

export function useSnackbar(): ShowSnackbar {
  return useContext(SnackbarContext);
}

const styles = StyleSheet.create({
  host: { position: 'absolute', left: 16, right: 16 },
  bar: {
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 52,
    paddingLeft: 16,
    paddingRight: 4,
    borderRadius: radius.card,
  },
  message: { flex: 1 },
  action: { height: 44, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 6 },
  pressed: { opacity: 0.6 },
  track: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 3 },
  line: { height: 3, borderTopRightRadius: 2, borderBottomRightRadius: 2 },
});
