import { ArrowLeftRight, CalendarDays, Plus, Star, StarOff, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { shortDay } from '@/features/today/lib/present';
import { addDays, type DateString, isoWeekday } from '@/lib/dates';
import { Button, Chip, SegmentedToggle, Sheet, Text, TextField, Toggle, useTheme } from '@/ui';

import type { NewTask } from '../hooks/useTaskActions';
import { type Priority, type TaskRow, TOP3_MAX } from '../lib/tasks';
import { taskSub } from './TaskItem';

const PRIORITY_OPTIONS = [
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
] as const;

/** The coming Saturday (or next week's when today is Saturday). */
const nextSaturday = (today: DateString) => addDays(today, (6 - isoWeekday(today) + 7) % 7 || 7);

/** Tasks-QuickAdd design: title, priority (default medium), due, add to today's top 3. */
export function QuickAddSheet({
  today,
  top3Count,
  onAdd,
  onClose,
}: {
  today: DateString;
  top3Count: number;
  onAdd: (t: NewTask) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [due, setDue] = useState<DateString | null>(null);
  const [picking, setPicking] = useState(false);
  const [top3, setTop3] = useState(false);
  const sat = nextSaturday(today);
  const quick: [string, DateString][] = [
    ['Today', today],
    ['Tomorrow', addDays(today, 1)],
    ...(sat !== addDays(today, 1)
      ? ([[shortDay(sat).slice(0, -4), sat]] as [string, DateString][])
      : []),
  ];
  const picked = due !== null && !quick.some(([, d]) => d === due);
  const ok = title.trim().length > 0;
  return (
    <Sheet visible onClose={onClose} title="New task" testID="task-add-sheet">
      <View style={styles.content}>
        <TextField
          label="Task"
          value={title}
          onChangeText={setTitle}
          placeholder="What needs doing?"
          maxLength={200}
          returnKeyType="done"
        />
        <Text variant="sub" weight={600}>
          Priority
        </Text>
        <SegmentedToggle
          accessibilityLabel="Priority"
          options={PRIORITY_OPTIONS}
          value={priority}
          onChange={setPriority}
        />
        <Text variant="sub" weight={600}>
          Due
        </Text>
        <View style={styles.chips}>
          {quick.map(([label, d]) => (
            <Chip
              key={d}
              label={label}
              selected={due === d}
              accessibilityLabel={`Due ${label}`}
              onPress={() => setDue(due === d ? null : d)}
            />
          ))}
          <Chip
            label={picked ? shortDay(due) : 'Pick date'}
            leadingIcon={CalendarDays}
            selected={picked}
            accessibilityLabel="Pick a due date"
            onPress={() => setPicking((v) => !v)}
          />
        </View>
        {picking ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} testID="date-strip">
            <View style={styles.chips}>
              {Array.from({ length: 28 }, (_, i) => addDays(today, i + 2)).map((d) => (
                <Chip
                  key={d}
                  label={shortDay(d)}
                  selected={due === d}
                  accessibilityLabel={`Due ${shortDay(d)}`}
                  onPress={() => {
                    setDue(d);
                    setPicking(false);
                  }}
                />
              ))}
            </View>
          </ScrollView>
        ) : null}
        <Toggle
          label="Add to today’s top 3"
          hint={
            top3Count >= TOP3_MAX
              ? 'Top 3 is full; you’ll swap one out'
              : `${top3Count} of 3 picked`
          }
          value={top3}
          onChange={setTop3}
        />
        <Button
          icon={Plus}
          label="Add task"
          accessibilityLabel="Add task"
          disabled={!ok}
          fullWidth
          onPress={() => onAdd({ title, priority, dueDate: due, top3 })}
        />
      </View>
    </Sheet>
  );
}

/** Tasks-SwapTop3 design: pick which of the three goes back to pending. */
export function SwapTop3Sheet({
  title,
  full,
  today,
  onSwap,
  onKeep,
  onClose,
}: {
  title: string;
  full: readonly TaskRow[];
  today: DateString;
  onSwap: (clientId: string) => void;
  onKeep: () => void;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const doneOne = full.find((t) => t.status === 'done');
  const [pick, setPick] = useState(doneOne?.client_id ?? full.at(-1)?.client_id ?? '');
  const chosen = full.find((t) => t.client_id === pick);
  return (
    <Sheet
      visible
      onClose={onClose}
      title="Top 3 is full"
      subtitle={`Adding “${title}” means one of these goes back to the pending list. Three is the limit on purpose.`}
      testID="swap-sheet"
    >
      <View style={styles.content}>
        {full.map((t) => {
          const on = t.client_id === pick;
          return (
            <Pressable
              key={t.client_id}
              onPress={() => setPick(t.client_id)}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${t.title}. ${t.status === 'done' ? 'Done, frees a slot' : t.priority}`}
              style={[
                styles.option,
                {
                  borderColor: on ? colors.accents.primary.base : colors.hairline,
                  backgroundColor: colors.raised,
                },
              ]}
            >
              <View
                style={[
                  styles.radio,
                  { borderColor: on ? colors.accents.primary.base : colors.textSecondary },
                ]}
              >
                {on ? (
                  <View style={[styles.dot, { backgroundColor: colors.accents.primary.base }]} />
                ) : null}
              </View>
              <View style={styles.flex}>
                <Text variant="body" weight={600}>
                  {t.title}
                </Text>
                <Text variant="caption" tone="secondary">
                  {t.status === 'done'
                    ? `${taskSub(t, today)} · frees a slot`
                    : `${t.priority[0]!.toUpperCase()}${t.priority.slice(1)} · ${taskSub(t, today).toLowerCase()}`}
                </Text>
              </View>
            </Pressable>
          );
        })}
        <Button
          icon={ArrowLeftRight}
          label={chosen?.status === 'done' ? 'Swap out the done task' : 'Swap it out'}
          accessibilityLabel={`Swap out ${chosen?.title ?? ''}`}
          fullWidth
          onPress={() => onSwap(pick)}
        />
        <Button
          variant="secondary"
          label="Keep top 3, add to pending"
          accessibilityLabel="Keep top 3, add to pending"
          fullWidth
          onPress={onKeep}
        />
      </View>
    </Sheet>
  );
}

/** Options for one task: top 3 in/out, delete. */
export function TaskOptionsSheet({
  task,
  inTop3,
  onTop3,
  onDelete,
  onClose,
}: {
  task: TaskRow;
  inTop3: boolean;
  onTop3: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  return (
    <Sheet visible onClose={onClose} title={task.title} testID="task-options">
      <View style={styles.content}>
        {task.status === 'open' || inTop3 ? (
          <Button
            icon={inTop3 ? StarOff : Star}
            variant="secondary"
            label={inTop3 ? 'Remove from today’s top 3' : 'Add to today’s top 3'}
            accessibilityLabel={inTop3 ? 'Remove from today’s top 3' : 'Add to today’s top 3'}
            fullWidth
            onPress={onTop3}
          />
        ) : null}
        <Button
          icon={Trash2}
          variant="destructive"
          label="Delete task"
          accessibilityLabel="Delete task"
          fullWidth
          onPress={onDelete}
        />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  content: { gap: 12, paddingBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  flex: { flex: 1 },
});
