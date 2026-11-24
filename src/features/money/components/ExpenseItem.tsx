import { Trash } from 'lucide-react-native';
import { useRef } from 'react';
import { type AccessibilityActionEvent, Pressable, StyleSheet, View } from 'react-native';
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';

import { shortDay } from '@/features/today/lib/present';
import { istClock } from '@/lib/dates';
import { formatClock, formatInr } from '@/lib/format';
import { Text, useTheme } from '@/ui';

import type { ExpenseCategoryRow, ExpenseRow } from '../api';
import { methodLabel } from '../lib/expense';
import { CategoryTile, SourcePill } from './look';

const ACTION_W = 84;

/** "Today 1:05 pm · UPI" (time only for today's rows). */
export function whenLine(e: ExpenseRow, today: string): string {
  const day = e.date === today ? 'Today' : shortDay(e.date);
  const time = e.date === today && e.created_at ? ` ${formatClock(istClock(e.created_at))}` : '';
  return `${day}${time} · ${methodLabel(e.payment_method)}`;
}

/** Transaction row (Money designs); swipe left → Delete, no confirm (Undo instead). */
export function ExpenseItem({
  expense: e,
  category,
  color,
  today,
  divider,
  onDelete,
}: {
  expense: ExpenseRow;
  category: ExpenseCategoryRow | undefined;
  color: string;
  today: string;
  divider?: boolean;
  onDelete?: () => void;
}) {
  const { colors } = useTheme();
  const swipe = useRef<SwipeableMethods>(null);
  const credit = e.direction === 'credit';
  const title = e.merchant || e.note || category?.name || (credit ? 'Received' : 'Expense');
  const amount = `${credit ? '+' : '−'}${formatInr(Number(e.amount_inr), Number(e.amount_inr) % 1 ? 2 : 0)}`;
  const label = `${title}, ${credit ? 'received' : 'spent'} ${formatInr(Number(e.amount_inr))}, ${whenLine(e, today)}${category ? `, ${category.name}` : ''}`;

  const row = (
    <View
      accessible
      accessibilityLabel={label}
      accessibilityActions={onDelete ? [{ name: 'delete', label: 'Delete' }] : []}
      onAccessibilityAction={(ev: AccessibilityActionEvent) => {
        if (ev.nativeEvent.actionName === 'delete') onDelete?.();
      }}
      style={[
        styles.row,
        { backgroundColor: colors.raised },
        divider ? { borderTopWidth: 1, borderColor: colors.hairline } : null,
      ]}
    >
      <CategoryTile icon={category?.icon} color={color} />
      <View style={styles.text}>
        <Text variant="body" weight={600} numberOfLines={1}>
          {e.merchant && e.note ? `${e.merchant} · ${e.note}` : title}
        </Text>
        <View style={styles.meta}>
          <Text variant="caption" tone="secondary">
            {whenLine(e, today)}
          </Text>
          <SourcePill source={e.source} />
        </View>
      </View>
      <Text
        variant="body"
        weight={700}
        num
        style={credit ? { color: colors.accents.success.base } : null}
      >
        {amount}
      </Text>
    </View>
  );

  if (!onDelete) return row;
  return (
    <ReanimatedSwipeable
      ref={swipe}
      friction={1.5}
      rightThreshold={ACTION_W * 0.6}
      overshootRight={false}
      renderRightActions={() => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Delete ${title}`}
          onPress={() => {
            swipe.current?.close();
            onDelete();
          }}
          style={[styles.action, { backgroundColor: colors.buttonDestructive }]}
        >
          <Trash size={18} color={colors.onButton} strokeWidth={2} />
          <Text variant="caption" weight={700} tone="onButton">
            Delete
          </Text>
        </Pressable>
      )}
    >
      {row}
    </ReanimatedSwipeable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, minHeight: 60 },
  text: { flex: 1, gap: 2 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  action: { width: ACTION_W, alignItems: 'center', justifyContent: 'center', gap: 2 },
});
