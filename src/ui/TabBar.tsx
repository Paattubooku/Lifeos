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
import { radius } from './theme';

export type TabKey = 'today' | 'food' | 'train' | 'progress' | 'more';

export const TABS: Record<TabKey, { label: string; icon: LucideIcon }> = {
  today: { label: 'Today', icon: CalendarDays },
  food: { label: 'Food', icon: Soup },
  train: { label: 'Train', icon: Dumbbell },
  progress: { label: 'Progress', icon: ChartColumn },
  more: { label: 'More', icon: Ellipsis },
};

/** Height of the tab row (design: 56). The docked bar adds the bottom safe area below it. */
export const TAB_BAR_HEIGHT = 56;

/** Bottom padding of the docked bar: the home-indicator area (design: 30 on iPhone). */
export const tabBarBottom = (bottomInset: number) => Math.max(bottomInset, 8);

/** How far screens pad their content so the last card clears the bar. */
export function tabBarClearance(bottomInset: number) {
  return TAB_BAR_HEIGHT + tabBarBottom(bottomInset) + 16;
}

export type TabBarItemsProps = {
  routes: { key: string; name: string }[];
  /** Space under the tabs for the home indicator (the bar's own bottom padding). */
  bottomInset?: number;
  activeIndex: number;
  onSelect: (index: number) => void;
  /** Red dot on a tab, e.g. More when changes failed to sync. */
  badges?: Partial<Record<TabKey, boolean>>;
};

/** Presentational pill bar (tested on its own; `TabBar` adapts it to Expo Router). */
export function TabBarItems({
  routes,
  activeIndex,
  onSelect,
  badges,
  bottomInset = 0,
}: TabBarItemsProps) {
  const { colors } = useTheme();
  return (
    <View
      accessibilityRole="tablist"
      testID="tab-bar"
      style={[
        styles.bar,
        {
          backgroundColor: colors.tabBar,
          borderTopColor: colors.hairline,
          paddingBottom: bottomInset,
        },
      ]}
    >
      {routes.map((route, index) => {
        const meta = TABS[route.name as TabKey];
        if (!meta) return null;
        const active = index === activeIndex;
        const color = active ? colors.accents.primary.text : colors.textSecondary;
        const Icon = meta.icon;
        const badge = badges?.[route.name as TabKey] ?? false;
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityLabel={badge ? `${meta.label}, needs attention` : meta.label}
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
            <View>
              <Icon size={22} color={color} strokeWidth={active ? 2 : 1.75} />
              {badge ? (
                <View
                  testID={`tab-badge-${route.name}`}
                  style={[
                    styles.badge,
                    { backgroundColor: colors.accents.danger.base, borderColor: colors.tabBar },
                  ]}
                />
              ) : null}
            </View>
            <Text variant="kicker" weight={active ? 600 : 500} style={[styles.label, { color }]}>
              {meta.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Docked tab bar (design: full width, solid, hairline on top) for `<Tabs tabBar={…}>`. */
export function TabBar({
  state,
  navigateToTab,
  badges,
}: BottomTabBarProps & { badges?: TabBarItemsProps['badges'] }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.dock}>
      <TabBarItems
        routes={state.routes}
        bottomInset={tabBarBottom(insets.bottom)}
        activeIndex={state.index}
        badges={badges}
        onSelect={(index) => {
          const route = state.routes[index];
          if (route && index !== state.index) navigateToTab(route.key);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  dock: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  bar: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth * 2 },
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
  badge: {
    position: 'absolute',
    top: -2,
    right: -4,
    width: 9,
    height: 9,
    borderRadius: 5,
    borderWidth: 1.5,
  },
});
