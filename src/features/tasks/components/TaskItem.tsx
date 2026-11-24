import { Pressable, StyleSheet, View } from 'react-native';

import { shortDay } from '@/features/today/lib/present';
import { istClock } from '@/lib/dates';
import { formatClock } from '@/lib/format';
import { Checkbox, Text, useTheme } from '@/ui';

import { dueNote, isOverdue, type TaskRow } from '../lib/tasks';

export function usePriorityColor() {
  const { colors } = useTheme();
  return (p: string) =>
    p === 'high'
      ? colors.accents.danger.base
      : p === 'medium'
        ? colors.accents.calories.base
        : colors.textSecondary;
}

/** "Thu 19 Nov · 4 days overdue" / "Done 11:40 am" / "No date". */
export function taskSub(t: TaskRow, today: string): string {
  if (t.status === 'done' && t.done_at) return `Done ${formatClock(istClock(t.done_at))}`;
  if (!t.due_date) return 'No date';
  const note = dueNote(t, today);
  if (note === 'Due today' || note === 'Due tomorrow') return note;
  return [shortDay(t.due_date), note].filter(Boolean).join(' · ');
}

/** Tasks-List row: priority bar, checkbox, title, due line (overdue in danger). */
export function TaskItem({
  task,
  today,
  divider,
  onToggle,
  onOpen,
}: {
  task: TaskRow;
  today: string;
  divider?: boolean;
  onToggle: () => void;
  onOpen: () => void;
}) {
  const { colors } = useTheme();
  const color = usePriorityColor();
  const done = task.status === 'done';
  const overdue = isOverdue(task, today);
  return (
    <View
      style={[styles.row, divider ? { borderTopWidth: 1, borderColor: colors.hairline } : null]}
      testID={`task-${task.client_id}`}
    >
      <View style={[styles.bar, { backgroundColor: color(task.priority) }]} />
      <Checkbox
        checked={done}
        onToggle={onToggle}
        accessibilityLabel={`${task.title}, ${task.priority} priority. ${done ? 'Mark not done' : 'Mark done'}`}
      />
      <Pressable
        style={styles.text}
        onPress={onOpen}
        onLongPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={`${task.title}. ${taskSub(task, today)}. Options`}
      >
        <Text
          variant="body"
          weight={600}
          tone={done ? 'secondary' : 'default'}
          style={done ? styles.strike : null}
        >
          {task.title}
        </Text>
        <Text
          variant="caption"
          weight={overdue ? 700 : 400}
          tone="secondary"
          style={overdue ? { color: colors.accents.danger.base } : null}
        >
          {taskSub(task, today)}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  bar: { width: 3, alignSelf: 'stretch', borderRadius: 2 },
  text: { flex: 1, gap: 2, minHeight: 44, justifyContent: 'center' },
  strike: { textDecorationLine: 'line-through' },
});
