import { X } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { istClock } from '@/lib/dates';
import { formatClock } from '@/lib/format';
import { StatusChip, Text, useTheme } from '@/ui';

import { type FoodLogRow, num } from '../lib/plan';

/** Off-plan entries under a meal (or in "Other"), each marked and removable. */
export function OffPlanRows({
  logs,
  onRemove,
}: {
  logs: readonly FoodLogRow[];
  onRemove: (l: FoodLogRow) => void;
}) {
  const { colors } = useTheme();
  return (
    <>
      {logs.map((l) => (
        <View
          key={l.client_id}
          style={[styles.row, { borderTopColor: colors.hairline }]}
          testID={`offplan-${l.client_id}`}
        >
          <View style={styles.flex}>
            <View style={styles.title}>
              <Text variant="body" weight={600} numberOfLines={1} style={styles.shrink}>
                {l.free_text ?? 'Off-plan'}
              </Text>
              <StatusChip label="OFF-PLAN" tone="calories" />
            </View>
            <Text variant="caption" tone="secondary">
              {formatClock(istClock(l.logged_at))}
            </Text>
          </View>
          <View style={styles.right}>
            <Text variant="sub" weight={700} num>{`${l.kcal} kcal`}</Text>
            <Text
              variant="caption"
              tone="protein"
              weight={700}
              num
            >{`${Math.round(num(l.protein_g))} g`}</Text>
          </View>
          <Pressable
            onPress={() => onRemove(l)}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${l.free_text ?? 'off-plan entry'}`}
            hitSlop={6}
            style={styles.x}
          >
            <X size={16} color={colors.textSecondary} strokeWidth={2} />
          </Pressable>
        </View>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: 1, paddingTop: 8 },
  flex: { flex: 1, minWidth: 0 },
  title: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  shrink: { flexShrink: 1 },
  right: { alignItems: 'flex-end' },
  x: { width: 32, height: 44, alignItems: 'center', justifyContent: 'center' },
});
