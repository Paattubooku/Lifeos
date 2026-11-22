import { Check, Clock, Trash } from 'lucide-react-native';
import { useRef } from 'react';
import { type AccessibilityActionEvent, Pressable, StyleSheet, View } from 'react-native';
import ReanimatedSwipeable, {
  type SwipeableMethods,
  SwipeDirection,
} from 'react-native-gesture-handler/ReanimatedSwipeable';

import { Checkbox } from './Checkbox';
import { haptics } from './haptics';
import { Text } from './Text';
import { useTheme } from './ThemeProvider';

export type ListRowProps = {
  title: string;
  /** Right-hand meta: "Due today", "11:40 am". */
  meta?: string;
  metaTone?: 'secondary' | 'danger';
  done?: boolean;
  /** Checkbox toggle. Swipe right also completes. */
  onToggle?: (next: boolean) => void;
  /** Swipe left actions. */
  onTomorrow?: () => void;
  onDelete?: () => void;
  testID?: string;
};

const ACTION_W = 80;
const DONE_W = 88;

/** Checkbox row; swipe right = done, swipe left = Tomorrow / Delete. */
export function ListRow({
  title,
  meta,
  metaTone = 'secondary',
  done = false,
  onToggle,
  onTomorrow,
  onDelete,
  testID,
}: ListRowProps) {
  const { colors } = useTheme();
  const swipe = useRef<SwipeableMethods>(null);
  const hasRight = !!(onTomorrow || onDelete);

  const actions = [
    onToggle && { name: 'done', label: done ? 'Mark as not done' : 'Mark as done' },
    onTomorrow && { name: 'tomorrow', label: 'Move to tomorrow' },
    onDelete && { name: 'delete', label: 'Delete' },
  ].filter((a): a is { name: string; label: string } => !!a);

  const onAccessibilityAction = (e: AccessibilityActionEvent) => {
    if (e.nativeEvent.actionName === 'done') onToggle?.(!done);
    if (e.nativeEvent.actionName === 'tomorrow') onTomorrow?.();
    if (e.nativeEvent.actionName === 'delete') onDelete?.();
  };

  const renderDone = () => (
    <View style={[styles.action, { width: DONE_W, backgroundColor: colors.accents.success.base }]}>
      <Check size={18} color={colors.onButton} strokeWidth={2.5} />
      <Text variant="caption" weight={700} tone="onButton">
        Done
      </Text>
    </View>
  );

  const renderRight = () => (
    <View style={styles.rightActions}>
      {onTomorrow ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Move ${title} to tomorrow`}
          onPress={() => {
            swipe.current?.close();
            onTomorrow();
          }}
          style={[styles.action, { width: ACTION_W, backgroundColor: colors.recessed }]}
        >
          <Clock size={18} color={colors.text} strokeWidth={2} />
          <Text variant="caption" weight={600}>
            Tomorrow
          </Text>
        </Pressable>
      ) : null}
      {onDelete ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Delete ${title}`}
          onPress={() => {
            swipe.current?.close();
            onDelete();
          }}
          style={[styles.action, { width: ACTION_W, backgroundColor: colors.accents.danger.base }]}
        >
          <Trash size={18} color={colors.onButton} strokeWidth={2} />
          <Text variant="caption" weight={700} tone="onButton">
            Delete
          </Text>
        </Pressable>
      ) : null}
    </View>
  );

  return (
    <View testID={testID} style={styles.clip}>
      <ReanimatedSwipeable
        ref={swipe}
        friction={1.5}
        leftThreshold={DONE_W * 0.6}
        rightThreshold={ACTION_W * 0.6}
        overshootLeft={false}
        overshootRight={false}
        renderLeftActions={onToggle && !done ? renderDone : undefined}
        renderRightActions={hasRight ? renderRight : undefined}
        onSwipeableOpen={(direction) => {
          if (direction === SwipeDirection.RIGHT && onToggle) {
            haptics.success();
            onToggle(true);
            swipe.current?.close();
          }
        }}
      >
        <View
          accessible
          accessibilityLabel={[title, meta, done ? 'done' : undefined].filter(Boolean).join(', ')}
          accessibilityActions={actions.map((a) => ({ name: a.name, label: a.label }))}
          onAccessibilityAction={onAccessibilityAction}
          style={[styles.row, { backgroundColor: colors.recessed }]}
        >
          {onToggle ? (
            <Checkbox checked={done} onToggle={onToggle} accessibilityLabel={`Complete ${title}`} />
          ) : (
            <View style={styles.spacer} />
          )}
          <Text
            variant="body"
            tone={done ? 'secondary' : 'default'}
            strike={done}
            style={styles.title}
          >
            {title}
          </Text>
          {meta ? (
            <Text
              variant="caption"
              num
              style={{
                color: metaTone === 'danger' ? colors.accents.danger.text : colors.textSecondary,
              }}
            >
              {meta}
            </Text>
          ) : null}
        </View>
      </ReanimatedSwipeable>
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { borderRadius: 18, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 56, paddingRight: 12 },
  spacer: { width: 12 },
  title: { flex: 1 },
  rightActions: { flexDirection: 'row' },
  action: { alignItems: 'center', justifyContent: 'center', gap: 2 },
});
