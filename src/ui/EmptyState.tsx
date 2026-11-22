import type { LucideIcon } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { Button } from './Button';
import { Text } from './Text';
import { useTheme } from './ThemeProvider';

export type EmptyStateProps = {
  icon: LucideIcon;
  /** The one fact ("No tasks for today"). */
  title: string;
  body?: string;
  /** The one action. */
  action?: { label: string; onPress: () => void; accessibilityLabel: string; icon?: LucideIcon };
  testID?: string;
};

/** Cobalt icon disc + one fact + one action. */
export function EmptyState({ icon: Icon, title, body, action, testID }: EmptyStateProps) {
  const { colors } = useTheme();
  return (
    <View testID={testID} style={styles.wrap}>
      <View style={[styles.disc, { backgroundColor: colors.accents.primary.tint }]}>
        <Icon size={24} color={colors.accents.primary.text} strokeWidth={2} />
      </View>
      <Text variant="body" weight={600} align="center" accessibilityRole="header">
        {title}
      </Text>
      {body ? (
        <Text variant="sub" tone="secondary" align="center">
          {body}
        </Text>
      ) : null}
      {action ? (
        <Button
          variant="secondary"
          label={action.label}
          icon={action.icon}
          onPress={action.onPress}
          accessibilityLabel={action.accessibilityLabel}
          style={styles.action}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 8, paddingVertical: 16, paddingHorizontal: 8 },
  disc: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  action: { marginTop: 4 },
});
