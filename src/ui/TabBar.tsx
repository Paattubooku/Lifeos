import type { BottomTabBarProps } from 'expo-router/js-tabs';
import {
  CalendarDays,
  ChartColumn,
  Dumbbell,
  Ellipsis,
  type LucideIcon,
  Soup,
} from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { haptics } from './haptics';
import { Text } from './Text';
import { useTheme } from './ThemeProvider';
import { cardShadow, radius } from './theme';

export type TabKey = 'today' | 'food' | 'train' | 'progress' | 'more';

export const TABS: Record<TabKey, { label: string; icon: LucideIcon }> = {
  today: { label: 'Today', icon: CalendarDays },
  food: { label: 'Food', icon: Soup },
  train: { label: 'Train', icon: Dumbbell },
  progress: { label: 'Progress', icon: ChartColumn },
  more: { label: 'More', icon: Ellipsis },
};

/** Height of the floating bar; screens pad their content by this + bottom inset. */
export const TAB_BAR_HEIGHT = 56;

export function tabBarClearance(bottomInset: number) {
  return TAB_BAR_HEIGHT + Math.max(bottomInset, 12) + 16;
}

export type TabBarItemsProps = {
  routes: { key: string; name: string }[];
  activeIndex: number;
  onSelect: (index: number) => void;
};

/** Presentational pill bar (tested on its own; `TabBar` adapts it to Expo Router). */
export function TabBarItems({ routes, activeIndex, onSelect }: TabBarItemsProps) {
  const { colors, scheme } = useTheme();
  return (
    <View
      accessibilityRole="tablist"
      style={[
        styles.bar,
        { backgroundColor: colors.tabBar, borderColor: colors.hairline },
        cardShadow(scheme),
      ]}
    >
      {routes.map((route, index) => {
        const meta = TABS[route.name as TabKey];
        if (!meta) return null;
        const active = index === activeIndex;
        const color = active ? colors.accents.primary.text : colors.textSecondary;
        const Icon = meta.icon;
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityLabel={meta.label}
            accessibilityState={{ selected: active }}
            onPress={() => {
              if (!active) haptics.tap();
              onSelect(index);
            }}
            style={styles.item}
          >
            {active ? (
              <Animated.View
                entering={ZoomIn.springify().damping(14)}
                style={[styles.pill, { backgroundColor: colors.accents.primary.tint }]}
              />
            ) : null}
            <Icon size={20} color={color} strokeWidth={2} />
            <Text variant="kicker" weight={active ? 600 : 500} style={[styles.label, { color }]}>
              {meta.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Floating tab bar for `<Tabs tabBar={(p) => <TabBar {...p} />}>`. */
export function TabBar({ state, navigateToTab }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View pointerEvents="box-none" style={[styles.float, { bottom: Math.max(insets.bottom, 12) }]}>
      <TabBarItems
        routes={state.routes}
        activeIndex={state.index}
        onSelect={(index) => {
          const route = state.routes[index];
          if (route && index !== state.index) navigateToTab(route.key);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  float: { position: 'absolute', left: 16, right: 16 },
  bar: { flexDirection: 'row', borderRadius: radius.card, borderWidth: 1 },
  item: {
    flex: 1,
    height: TAB_BAR_HEIGHT,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 9,
    gap: 4,
  },
  pill: {
    position: 'absolute',
    top: 6,
    width: 56,
    height: 30,
    borderRadius: radius.pill,
  },
  label: { textTransform: 'none', letterSpacing: 0.11 },
});
