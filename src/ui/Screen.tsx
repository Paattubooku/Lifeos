import { type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
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
};

/** Canvas + safe area + scroll + 36 px screen title. */
export function Screen({ title, subtitle, children, withTabBar = true, accessory }: ScreenProps) {
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
      <View style={styles.titleRow}>
        <View style={styles.titles}>
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
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  titles: { flex: 1, gap: 2 },
});
