import { type ReactNode } from 'react';
import { ChevronLeft } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { tabBarClearance } from './TabBar';
import { Text } from './Text';
import { useTheme } from './ThemeProvider';
import { space } from './theme';

export type ScreenProps = {
  title: string;
  subtitle?: string;
  children?: ReactNode;
  /** Leave room for the floating tab bar (tab screens). */
  withTabBar?: boolean;
  /** Right side of the title row (e.g. a chip). */
  accessory?: ReactNode;
  /** "‹ More" link above the title (pushed screens). */
  back?: { label: string; onPress: () => void };
  /** Top-right action above the title (e.g. "+ New"). */
  action?: ReactNode;
  /** Small uppercase line above the title ("MON 23 NOV · 5 OF 11 DONE"). */
  kicker?: string;
};

/** Canvas + safe area + scroll + 36 px screen title. */
export function Screen({
  title,
  subtitle,
  children,
  withTabBar = true,
  accessory,
  back,
  action,
  kicker,
}: ScreenProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={{ backgroundColor: colors.canvas }}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: insets.top + space.lg,
          paddingBottom: (withTabBar ? tabBarClearance(insets.bottom) : insets.bottom) + space.xl,
        },
      ]}
    >
      {back || action ? (
        <View style={styles.topRow}>
          {back ? (
            <Pressable
              onPress={back.onPress}
              accessibilityRole="button"
              accessibilityLabel={`Back to ${back.label}`}
              hitSlop={12}
              style={styles.back}
            >
              <ChevronLeft size={20} color={colors.accents.primary.text} strokeWidth={2.2} />
              <Text variant="body" tone="primary">
                {back.label}
              </Text>
            </Pressable>
          ) : (
            <View />
          )}
          {action}
        </View>
      ) : null}
      <View style={styles.titleRow}>
        <View style={styles.titles}>
          {kicker ? (
            <Text variant="kicker" tone="secondary">
              {kicker}
            </Text>
          ) : null}
          <Text variant="title" accessibilityRole="header">
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: space.lg, gap: space.lg },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: -space.sm,
  },
  back: { flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 44 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  titles: { flex: 1, gap: 2 },
});
