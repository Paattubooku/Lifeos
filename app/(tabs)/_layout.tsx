import { Tabs } from 'expo-router/js-tabs';

import { selectDeadCount } from '@/features/sync/selectors';
import { useAppSelector } from '@/store';
import { TabBar, useTheme } from '@/ui';

export default function TabsLayout() {
  const { colors } = useTheme();
  const syncIssue = useAppSelector(selectDeadCount) > 0;
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} badges={{ more: syncIssue }} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.canvas } }}
    >
      <Tabs.Screen name="today" />
      <Tabs.Screen name="food" />
      <Tabs.Screen name="train" />
      <Tabs.Screen name="progress" />
      <Tabs.Screen name="more" />
    </Tabs>
  );
}
