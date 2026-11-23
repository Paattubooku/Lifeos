import { BlurView } from 'expo-blur';
import { type ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from './Text';
import { useTheme } from './ThemeProvider';
import { motion, radius } from './theme';

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

/**
 * Bottom sheet: radius-24 top over a blurred, tinted scrim; springs up from below.
 * Tap the scrim or use Android back to close. Reanimated layout animations
 * respect the system Reduce Motion setting.
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

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      {visible ? (
        <View style={styles.root}>
          <Animated.View
            entering={FadeIn.duration(motion.scrim)}
            exiting={FadeOut.duration(200)}
            style={StyleSheet.absoluteFill}
          >
            <BlurView intensity={20} tint={scheme} style={StyleSheet.absoluteFill} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close sheet"
              onPress={onClose}
              style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim }]}
            />
          </Animated.View>
          <Animated.View
            testID={testID}
            accessibilityViewIsModal
            onAccessibilityEscape={onClose}
            entering={SlideInDown.springify().damping(18).stiffness(160)}
            exiting={SlideOutDown.duration(220)}
            style={[
              styles.panel,
              {
                backgroundColor: colors.raised,
                borderColor: colors.hairline,
                paddingBottom: Math.max(insets.bottom, 16) + 18,
                shadowColor: colors.shadow,
              },
            ]}
          >
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
            {children}
          </Animated.View>
        </View>
      ) : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerText: { flex: 1 },
  root: { flex: 1, justifyContent: 'flex-end' },
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
  handle: { width: 36, height: 5, borderRadius: radius.pill, alignSelf: 'center' },
  header: { gap: 2 },
});
