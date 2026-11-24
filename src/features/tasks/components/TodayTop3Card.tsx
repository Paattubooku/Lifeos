import { StyleSheet, View } from 'react-native';

import { istClock } from '@/lib/dates';
import { formatClock } from '@/lib/format';
import { Button, Card, Checkbox, Text } from '@/ui';

import { dueNote, type TaskRow } from '../lib/tasks';

/** PRD F17: Today shows the top 3 from 09:00 until 18:00. */
export const TOP3_FROM_MIN = 9 * 60;
export const TOP3_UNTIL_MIN = 18 * 60;

/** Today-0115pm design: "Top 3 · 1 done", compact rows, "All N" → Tasks. */
export function TodayTop3Card({
  top3,
  openCount,
  today,
  onToggle,
  onOpenTasks,
}: {
  top3: readonly TaskRow[];
  openCount: number;
  today: string;
  onToggle: (t: TaskRow) => void;
  onOpenTasks: () => void;
}) {
  const done = top3.filter((t) => t.status === 'done').length;
  return (
    <Card padding={16} gap={6} testID="today-top3">
      <View style={styles.head}>
        <Text variant="heading" style={styles.flex}>
          {'Top 3 '}
          <Text variant="sub" tone="secondary">
            {top3.length ? `· ${done} done` : '· none picked'}
          </Text>
        </Text>
        <Button
          size="sm"
          variant="secondary"
          label={`All ${openCount}`}
          accessibilityLabel={`All tasks, ${openCount} open`}
          onPress={onOpenTasks}
        />
      </View>
      {top3.length === 0 ? (
        <Text variant="sub" tone="secondary">
          Pick three things that matter today in Tasks.
        </Text>
      ) : (
        top3.map((t) => {
          const isDone = t.status === 'done';
          const note =
            isDone && t.done_at ? formatClock(istClock(t.done_at)) : (dueNote(t, today) ?? '');
          return (
            <View key={t.client_id} style={styles.row}>
              <Checkbox
                checked={isDone}
                onToggle={() => onToggle(t)}
                accessibilityLabel={`${t.title}. ${isDone ? 'Mark not done' : 'Mark done'}`}
              />
              <Text
                variant="body"
                weight={600}
                tone={isDone ? 'secondary' : 'default'}
                style={[styles.flex, isDone ? styles.strike : null]}
                numberOfLines={2}
              >
                {t.title}
              </Text>
              <Text variant="caption" tone="secondary">
                {note}
              </Text>
            </View>
          );
        })
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 },
  strike: { textDecorationLine: 'line-through' },
  flex: { flex: 1 },
});
