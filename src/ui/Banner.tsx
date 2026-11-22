import { CircleCheck, Info, type LucideIcon, TriangleExclamationPoint } from 'lucide-react-native';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { Button } from './Button';
import { Text } from './Text';
import { useTheme } from './ThemeProvider';
import { type Accent, cardShadow, radius } from './theme';

export type BannerTone = 'info' | 'warning' | 'danger' | 'success';

const TONE_ACCENT: Record<BannerTone, Accent> = {
  info: 'primary',
  warning: 'calories',
  danger: 'danger',
  success: 'success',
};

const TONE_ICON: Record<BannerTone, LucideIcon> = {
  info: Info,
  warning: TriangleExclamationPoint,
  danger: TriangleExclamationPoint,
  success: CircleCheck,
};

export type BannerProps = {
  /** Says the number… */
  title: string;
  /** …and the fix. */
  body?: string;
  tone?: BannerTone;
  icon?: LucideIcon;
  action?: { label: string; onPress: () => void; accessibilityLabel: string };
  testID?: string;
};

/** Raised plane with a tinted icon tile; the icon wobbles once on mount. */
export function Banner({ title, body, tone = 'info', icon, action, testID }: BannerProps) {
  const { colors, scheme } = useTheme();
  const accent = colors.accents[TONE_ACCENT[tone]];
  const Icon = icon ?? TONE_ICON[tone];

  const reduceMotion = useReducedMotion();
  const rotate = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) return;
    rotate.value = withDelay(
      700,
      withSequence(
        withTiming(-10, { duration: 175 }),
        withTiming(8, { duration: 175 }),
        withTiming(-4, { duration: 175 }),
        withTiming(0, { duration: 175 }),
      ),
    );
  }, [reduceMotion, rotate]);
  const wobble = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotate.value}deg` }] }));

  return (
    <View
      testID={testID}
      accessibilityRole={tone === 'danger' ? 'alert' : undefined}
      accessibilityLiveRegion="polite"
      style={[
        styles.banner,
        { backgroundColor: colors.raised, borderColor: colors.hairline },
        cardShadow(scheme),
      ]}
    >
      <Animated.View style={[styles.tile, { backgroundColor: accent.tint }, wobble]}>
        <Icon size={18} color={accent.text} strokeWidth={2.25} />
      </Animated.View>
      <View
        style={styles.copy}
        accessible
        accessibilityLabel={body ? `${title}${/[.!?]$/.test(title) ? '' : '.'} ${body}` : title}
      >
        <Text variant="button">{title}</Text>
        {body ? (
          <Text variant="caption" tone="secondary" style={styles.body}>
            {body}
          </Text>
        ) : null}
      </View>
      {action ? (
        <Button
          size="sm"
          label={action.label}
          onPress={action.onPress}
          accessibilityLabel={action.accessibilityLabel}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: radius.card,
    borderWidth: 1,
  },
  tile: {
    width: 36,
    height: 36,
    borderRadius: radius.tile,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { flex: 1, minWidth: 0 },
  body: { fontSize: 13, lineHeight: 19 },
});
