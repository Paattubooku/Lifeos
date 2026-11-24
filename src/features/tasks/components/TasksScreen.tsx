import { useRouter } from 'expo-router';
import { CheckCircle2, ChevronDown, ChevronUp, ListTodo, Plus, Star } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useNow } from '@/features/today/hooks/useNow';
import { Button, Card, EmptyState, Screen, Text, useTheme } from '@/ui';

import { useTasks } from '../hooks/useTasks';
import { useTop3Flow } from '../hooks/useTop3Flow';
import { COMPLETED_DAYS } from '../lib/tasks';
import { TaskItem, usePriorityColor } from './TaskItem';
import { QuickAddSheet } from './TaskSheets';

/** More → Tasks (Tasks-List design, PRD F17). */
export function TasksScreen({ now: fixedNow }: { now?: number } = {}) {
  const ticking = useNow(60_000);
  const now = fixedNow ?? ticking;
  const router = useRouter();
  const { colors } = useTheme();
  const color = usePriorityColor();
  const tasks = useTasks(now);
  const flow = useTop3Flow(tasks.all, tasks.today);
  const [adding, setAdding] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const top = tasks.top3;
  const doneTop = top.filter((t) => t.status === 'done').length;

  const item = (list: typeof top) =>
    list.map((t, i) => (
      <TaskItem
        key={t.client_id}
        task={t}
        today={tasks.today}
        divider={i > 0}
        onToggle={() => flow.toggleDone(t)}
        onOpen={() => flow.openOptions(t)}
      />
    ));

  return (
    <Screen
      title="Tasks"
      subtitle={tasks.header}
      withTabBar={false}
      back={{ label: 'More', onPress: () => router.back() }}
      action={
        <Button
          icon={Plus}
          size="sm"
          label="Add"
          accessibilityLabel="New task"
          onPress={() => setAdding(true)}
        />
      }
    >
      <Card
        padding={14}
        gap={4}
        testID="top3-card"
        style={{ borderColor: colors.accents.primary.base }}
      >
        <View style={styles.head}>
          <Text variant="kicker" tone="secondary" style={styles.flex}>
            Today’s top 3
          </Text>
          <Text variant="caption" tone="secondary">
            {top.length ? `${doneTop} of ${top.length} done` : 'none picked'}
          </Text>
        </View>
        {top.length ? (
          item(top)
        ) : (
          <Text variant="sub" tone="secondary">
            Three things that matter today. Tap a task below → Add to today’s top 3.
          </Text>
        )}
      </Card>

      {tasks.suggestions.length > 0 ? (
        <Card kicker="From yesterday’s top 3" padding={14} gap={4} testID="suggestions">
          {tasks.suggestions.map((t, i) => (
            <View
              key={t.client_id}
              style={[
                styles.suggest,
                i > 0 ? { borderTopWidth: 1, borderColor: colors.hairline } : null,
              ]}
            >
              <Text variant="body" weight={600} style={styles.flex}>
                {t.title}
              </Text>
              <Button
                icon={Star}
                size="sm"
                variant="secondary"
                label="Top 3"
                accessibilityLabel={`Add ${t.title} to today’s top 3`}
                onPress={() => flow.addToTop3(t)}
              />
            </View>
          ))}
        </Card>
      ) : null}

      <Card padding={14} gap={4} testID="pending-card">
        <View style={styles.head}>
          <Text variant="kicker" tone="secondary" style={styles.flex}>
            {`Pending · ${tasks.pending.length}`}
          </Text>
          <Text variant="caption" tone="secondary">
            priority, then due
          </Text>
        </View>
        {tasks.pending.length ? (
          item(tasks.pending)
        ) : (
          <EmptyState
            icon={ListTodo}
            title="All clear"
            body="Add what needs doing; pick three for today."
            action={{
              label: 'Add task',
              accessibilityLabel: 'Add a task',
              onPress: () => setAdding(true),
            }}
          />
        )}
      </Card>

      <Card padding={14} gap={4} testID="completed-card">
        <Pressable
          onPress={() => setShowDone((v) => !v)}
          accessibilityRole="button"
          accessibilityState={{ expanded: showDone }}
          accessibilityLabel={`Completed, ${tasks.completed.length} in the last ${COMPLETED_DAYS} days. ${showDone ? 'Hide' : 'Show'}`}
          style={styles.head}
        >
          <CheckCircle2 size={22} color={colors.accents.success.base} strokeWidth={2} />
          <Text variant="body" weight={700} style={styles.flex}>
            {`Completed · ${tasks.completed.length}`}
            <Text variant="sub" tone="secondary">{`  last ${COMPLETED_DAYS} days`}</Text>
          </Text>
          {showDone ? (
            <ChevronUp size={18} color={colors.textSecondary} />
          ) : (
            <ChevronDown size={18} color={colors.textSecondary} />
          )}
        </Pressable>
        {showDone ? item(tasks.completed) : null}
      </Card>

      <View style={styles.legend} accessibilityLabel="Priority colours: high, medium, low">
        {(['high', 'medium', 'low'] as const).map((p) => (
          <View key={p} style={styles.legendItem}>
            <View style={[styles.swatch, { backgroundColor: color(p) }]} />
            <Text variant="caption" tone="secondary">
              {p[0]!.toUpperCase() + p.slice(1)}
            </Text>
          </View>
        ))}
      </View>

      {adding ? (
        <QuickAddSheet
          today={tasks.today}
          top3Count={top.length}
          onClose={() => setAdding(false)}
          onAdd={(t) => {
            setAdding(false);
            flow.create(t);
          }}
        />
      ) : null}
      {flow.sheets}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 28 },
  suggest: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  legend: { flexDirection: 'row', gap: 16 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 3, height: 12, borderRadius: 2 },
  flex: { flex: 1 },
});
