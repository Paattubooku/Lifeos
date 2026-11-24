import { BlurView } from 'expo-blur';
import { createContext, type ReactNode, use, useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { Text } from './Text';
import { useTheme } from './ThemeProvider';
import { radius } from './theme';

export type SheetProps = {
  visible: boolean;
  onClose: () => void;
  title: string;
  /** One line of context with the number that matters. */
  subtitle?: string;
  children?: ReactNode;
  /** Right side of the header (e.g. a Delete button). */
  accessory?: ReactNode;
  testID?: string;
};

/** Rises without bounce: critically damped, overshoot clamped. */
const RISE = { damping: 34, stiffness: 320, mass: 1, overshootClamping: true } as const;
const SINK = { duration: 220, easing: Easing.in(Easing.cubic) };
/** Drag past this share of the panel (or flick) to close. */
const DISMISS_SHARE = 0.25;
const DISMISS_VELOCITY = 900;

const SheetCloseContext = createContext<(() => void) | null>(null);

/**
 * Inside a Sheet: close it with the exit animation (e.g. a Cancel button).
 * Falls back to `fallback` outside a sheet.
 */
export function useSheetClose(fallback: () => void): () => void {
  return use(SheetCloseContext) ?? fallback;
}

/**
 * Bottom sheet: radius-24 top over a blurred, tinted scrim.
 * Opens with a soft lift — the scrim fades in, the panel rises and grows from
 * 96 % without bouncing, and its content follows a beat later. Closes by
 * sinking (scrim tap, Android back, the screen-reader escape gesture, or a
 * downward swipe on the handle/header). Reduce Motion → a short fade only.
 * The owner must hide the sheet in `onClose` (unmount it or pass visible={false}).
 */
export function Sheet({
  visible,
  onClose,
  title,
  subtitle,
  children,
  accessory,
  testID,
}: SheetProps) {
  const { colors, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();

  // Stay mounted while the exit animation runs after `visible` turns false.
  const [shown, setShown] = useState(visible);
  if (visible && !shown) setShown(true);

  const progress = useSharedValue(0);
  const drag = useSharedValue(0);
  const height = useSharedValue(600);
  const closing = useSharedValue(false);

  const sink = (done: () => void) => {
    progress.set(
      withTiming(0, reduceMotion ? { duration: 120 } : SINK, (finished) => {
        if (finished) scheduleOnRN(done);
      }),
    );
  };

  /** Close from inside the sheet: animate out, then tell the owner. */
  const requestClose = () => {
    if (closing.get()) return;
    closing.set(true);
    sink(onClose);
  };

  useEffect(() => {
    if (visible) {
      closing.set(false);
      drag.set(0);
      progress.set(reduceMotion ? withTiming(1, { duration: 150 }) : withSpring(1, RISE));
    } else if (shown) {
      sink(() => setShown(false));
    }
    // `sink` only reads stable shared values; re-running on its identity would restart the animation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, reduceMotion]);

  const pan = Gesture.Pan()
    .activeOffsetY(8)
    .failOffsetY(-8)
    .onUpdate((e) => {
      drag.set(Math.max(0, e.translationY));
    })
    .onEnd((e) => {
      if (e.translationY > height.get() * DISMISS_SHARE || e.velocityY > DISMISS_VELOCITY) {
        scheduleOnRN(requestClose);
      } else {
        drag.set(withSpring(0, RISE));
      }
    });

  const scrimStyle = useAnimatedStyle(() => ({
    opacity: progress.get() * (1 - Math.min(drag.get() / Math.max(height.get(), 1), 1) * 0.6),
  }));
  const panelStyle = useAnimatedStyle(() => {
    const p = progress.get();
    if (reduceMotion) return { opacity: p, transform: [{ translateY: drag.get() }] };
    return {
      transform: [
        { translateY: (1 - p) * (height.get() + 40) + drag.get() },
        { scale: interpolate(p, [0, 1], [0.96, 1]) },
      ],
    };
  });
  const contentStyle = useAnimatedStyle(() => {
    const p = progress.get();
    if (reduceMotion) return {};
    return {
      opacity: interpolate(p, [0.55, 1], [0, 1], 'clamp'),
      transform: [{ translateY: interpolate(p, [0.55, 1], [12, 0], 'clamp') }],
    };
  });

  return (
    <Modal
      visible={shown}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={requestClose}
    >
      {shown ? (
        <GestureHandlerRootView style={styles.root}>
          <Animated.View style={[StyleSheet.absoluteFill, scrimStyle]}>
            <BlurView intensity={20} tint={scheme} style={StyleSheet.absoluteFill} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close sheet"
              onPress={requestClose}
              style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim }]}
            />
          </Animated.View>
          {/* iOS: the keyboard would cover the sheet's inputs; lift the panel above it. */}
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.avoid}
            pointerEvents="box-none"
          >
            <Animated.View
              testID={testID}
              accessibilityViewIsModal
              onAccessibilityEscape={requestClose}
              onLayout={(e) => height.set(e.nativeEvent.layout.height)}
              style={[
                styles.panel,
                {
                  backgroundColor: colors.raised,
                  borderColor: colors.hairline,
                  paddingBottom: Math.max(insets.bottom, 16) + 18,
                  shadowColor: colors.shadow,
                },
                panelStyle,
              ]}
            >
              <SheetCloseContext value={requestClose}>
                <GestureDetector gesture={pan}>
                  <View style={styles.grab}>
                    <View style={[styles.handle, { backgroundColor: colors.border }]} />
                    <View style={styles.headerRow}>
                      <View style={[styles.header, styles.headerText]}>
                        <Text variant="heading" accessibilityRole="header">
                          {title}
                        </Text>
                        {subtitle ? (
                          <Text variant="sub" tone="secondary">
                            {subtitle}
                          </Text>
                        ) : null}
                      </View>
                      {accessory}
                    </View>
                  </View>
                </GestureDetector>
                <Animated.View style={[styles.content, contentStyle]}>{children}</Animated.View>
              </SheetCloseContext>
            </Animated.View>
          </KeyboardAvoidingView>
        </GestureHandlerRootView>
      ) : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerText: { flex: 1 },
  root: { flex: 1, justifyContent: 'flex-end' },
  avoid: { flex: 1, justifyContent: 'flex-end' },
  panel: {
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    borderTopWidth: 1,
    paddingTop: 10,
    paddingHorizontal: 16,
    gap: 16,
    shadowOpacity: 0.18,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -12 },
    elevation: 12,
  },
  grab: { gap: 16 },
  content: { gap: 16 },
  handle: { width: 36, height: 5, borderRadius: radius.pill, alignSelf: 'center' },
  header: { gap: 2 },
});
