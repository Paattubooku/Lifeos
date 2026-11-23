import { useRouter } from 'expo-router';
import {
  ArrowDown,
  ArrowUp,
  CalendarClock,
  ChevronRight,
  Copy,
  GripVertical,
  Plus,
  SearchX,
} from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { formatClock } from '@/lib/format';
import { newClientId } from '@/lib/ids';
import { useAppDispatch } from '@/store';
import {
  Banner,
  Button,
  Card,
  Chip,
  EmptyState,
  PressableScale,
  Screen,
  Text,
  TextField,
  useSnackbar,
  useTheme,
} from '@/ui';

import { useBlockStreaks } from '@/features/today/hooks/useBlockStreaks';

import { useRoutine } from '../hooks/useRoutine';
import { type BlockLike, blockMeta, blocksOf, blocksSummary, hhmm } from '../lib/blocks';
import {
  planArchive,
  planDeleteTemplate,
  planDuplicate,
  planMove,
  planRestore,
  planTemplateRestore,
  planTemplateSave,
  removalRule,
  type TemplateRowLike,
  validateTemplateName,
} from '../lib/changes';
import { conflictText, WEEKDAY_SHORT, weekdayConflicts, weekdaysText } from '../lib/templates';
import { applyChanges } from '../slice';
import { BlockEditSheet } from './BlockEditSheet';
import { KindIcon } from './KindIcon';

/** Event-time clock (kept out of render for the React Compiler). */
const clock = () => Date.now();

/** "Habit · 10 min · 12 days" (PRD F06 per-block streaks; 2+ days). */
export const withStreak = (meta: string, days: number) =>
  days >= 2 ? `${meta} · ${days} days` : meta;

const WEEKDAY_NAMES = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

type Editing = { block: BlockLike | null; key: string } | null;

/** Routine-Blocks design + the template's own settings (name, days, duplicate, delete). */
export function TemplateScreen({ id }: { id: string }) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const showSnackbar = useSnackbar();
  const { colors } = useTheme();
  const { today, templates, blocks, recentDayLogs } = useRoutine();
  const streaks = useBlockStreaks(today);
  const [editing, setEditing] = useState<Editing>(null);
  const [reorder, setReorder] = useState(false);
  const [name, setName] = useState<string | null>(null);

  const all = templates as TemplateRowLike[];
  const t = all.find((x) => x.id === id);
  const back = { label: 'Routine', onPress: () => router.back() };

  if (!t) {
    return (
      <Screen title="Template" withTabBar={false} back={back}>
        <EmptyState
          icon={SearchX}
          title="Template not found"
          body="It may have been deleted on another phone."
        />
      </Screen>
    );
  }

  const list = blocksOf(blocks, t.id) as BlockLike[];
  const apply = (changes: Parameters<typeof applyChanges>[0]) => dispatch(applyChanges(changes));
  const nameValue = name ?? t.name;
  const nameError = validateTemplateName(nameValue);
  const lost = weekdayConflicts(all).filter((c) => c.others.some((o) => o.id === t.id));
  const rule = removalRule(t, { templates: all, dayLogs: recentDayLogs, today });

  const saveName = () => {
    if (name === null || nameError) return;
    void apply(planTemplateSave(t, { name, weekdays: t.weekdays }, clock()));
    setName(null);
  };

  const toggleDay = (day: number) => {
    const weekdays = t.weekdays.includes(day)
      ? t.weekdays.filter((d) => d !== day)
      : [...t.weekdays, day];
    void apply(planTemplateSave(t, { name: t.name, weekdays }, clock()));
  };

  const duplicate = async () => {
    const { templateId, changes } = planDuplicate(
      t,
      all,
      blocks as BlockLike[],
      newClientId,
      clock(),
    );
    await apply(changes);
    showSnackbar({ message: `${t.name} duplicated` });
    router.replace({ pathname: '/routine/[id]', params: { id: templateId } });
  };

  const remove = () => {
    const doDelete = async () => {
      const snapshot = { template: t, blocks: list, templates: all };
      await apply(planDeleteTemplate(t, all, blocks as BlockLike[], clock()));
      showSnackbar({
        message: `${t.name} deleted`,
        actionLabel: 'Undo',
        onAction: () =>
          void dispatch(
            applyChanges(
              planTemplateRestore(snapshot.template, snapshot.templates, snapshot.blocks, clock()),
            ),
          ),
      });
      router.back();
    };
    Alert.alert(`Delete ${t.name}?`, `Its ${list.length} blocks go too.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void doDelete() },
    ]);
  };

  const archive = async () => {
    await apply(planArchive(t, all, clock()));
    showSnackbar({
      message: `${t.name} archived`,
      actionLabel: 'Undo',
      onAction: () =>
        void dispatch(
          applyChanges([
            {
              op: 'upsert',
              table: 'routine_template',
              clientId: t.client_id,
              row: {
                archived_at: null,
                weekdays: t.weekdays,
                is_default: t.is_default,
                updated_at: new Date(clock()).toISOString(),
              },
            },
          ]),
        ),
    });
    router.back();
  };

  return (
    <Screen
      title={t.name}
      subtitle={`${weekdaysText(t.weekdays)} · ${blocksSummary(list)}`}
      withTabBar={false}
      back={back}
      action={
        t.archived_at ? undefined : (
          <Button
            label="Add block"
            icon={Plus}
            size="sm"
            accessibilityLabel="Add block"
            onPress={() => setEditing({ block: null, key: `new-${clock()}` })}
          />
        )
      }
    >
      {t.archived_at ? (
        <Banner
          tone="info"
          title="Archived"
          body="Hidden from Today and the week. Past days still show it."
          action={{
            label: 'Restore',
            accessibilityLabel: `Restore ${t.name}`,
            onPress: () => void apply(planRestore(t, clock())),
          }}
        />
      ) : null}
      {lost.map((c) => (
        <Banner
          key={c.weekday}
          tone="warning"
          title={conflictText(c)}
          testID={`conflict-${c.weekday}`}
        />
      ))}

      <Card padding={8} gap={0}>
        {list.length === 0 ? (
          <EmptyState
            icon={CalendarClock}
            title="No blocks yet"
            body="Add the first block of the day."
          />
        ) : null}
        {list.length > 1 && !t.archived_at ? (
          <View style={styles.reorderRow}>
            <Button
              variant="ghost"
              size="sm"
              label={reorder ? 'Done' : 'Reorder'}
              accessibilityLabel={reorder ? 'Done reordering' : 'Reorder blocks'}
              onPress={() => setReorder((r) => !r)}
            />
          </View>
        ) : null}
        {list.map((b, i) => (
          <View
            key={b.client_id}
            style={[
              styles.blockRow,
              i < list.length - 1 ? { borderBottomWidth: 1, borderColor: colors.hairline } : null,
            ]}
          >
            {reorder ? (
              <View style={styles.moves}>
                <MoveButton
                  label={`Move ${b.title} earlier`}
                  disabled={i === 0}
                  icon="up"
                  onPress={() => void apply(planMove(list, t.id, b.client_id, -1))}
                />
                <MoveButton
                  label={`Move ${b.title} later`}
                  disabled={i === list.length - 1}
                  icon="down"
                  onPress={() => void apply(planMove(list, t.id, b.client_id, 1))}
                />
              </View>
            ) : (
              <GripVertical size={16} color={colors.textSecondary} strokeWidth={2} />
            )}
            <Pressable
              style={styles.blockMain}
              disabled={reorder}
              accessibilityRole="button"
              accessibilityLabel={`${formatClock(hhmm(b.start_time))}, ${b.title}, ${withStreak(blockMeta(b), streaks.get(b.id) ?? 0)}. Edit`}
              onPress={() => setEditing({ block: b, key: b.client_id })}
            >
              <Text variant="sub" weight={700} num style={styles.time}>
                {formatClock(hhmm(b.start_time))}
              </Text>
              <KindIcon kind={b.kind} />
              <View style={styles.flex}>
                <Text variant="body" weight={600} numberOfLines={1}>
                  {b.title}
                </Text>
                <Text variant="caption" tone="secondary" numberOfLines={1}>
                  {withStreak(blockMeta(b), streaks.get(b.id) ?? 0)}
                </Text>
              </View>
              {reorder ? null : (
                <ChevronRight size={18} color={colors.textSecondary} strokeWidth={2} />
              )}
            </Pressable>
          </View>
        ))}
      </Card>

      <Card kicker="Template">
        <TextField
          label="Name"
          value={nameValue}
          onChangeText={setName}
          onEndEditing={saveName}
          onSubmitEditing={saveName}
          maxLength={60}
          returnKeyType="done"
          error={name !== null ? nameError : null}
        />
        <Text variant="sub" weight={600}>
          Runs on
        </Text>
        <View style={styles.days}>
          {WEEKDAY_SHORT.map((label, i) => (
            <Chip
              key={label}
              label={label}
              selected={t.weekdays.includes(i + 1)}
              accessibilityLabel={`Runs on ${WEEKDAY_NAMES[i]}`}
              onPress={() => toggleDay(i + 1)}
            />
          ))}
        </View>
        <Text variant="caption" tone="secondary">
          {t.weekdays.length === 0
            ? 'No days: apply it by hand with “Switch template” on Today.'
            : 'If two templates share a day, the one edited last wins.'}
        </Text>
        <View style={styles.actions}>
          <Button
            variant="secondary"
            icon={Copy}
            label="Duplicate"
            accessibilityLabel={`Duplicate ${t.name}`}
            onPress={() => void duplicate()}
          />
          {rule === 'delete' ? (
            <Button
              variant="destructive"
              label="Delete"
              accessibilityLabel={`Delete ${t.name}`}
              onPress={remove}
            />
          ) : rule === 'archive' && !t.archived_at ? (
            <Button
              variant="outline"
              label="Archive"
              accessibilityLabel={`Archive ${t.name}`}
              onPress={() => void archive()}
            />
          ) : null}
        </View>
        {rule === 'archive' && !t.archived_at ? (
          <Text variant="caption" tone="secondary" testID="archive-hint">
            Used by a day in the last 7 days, so it can’t be deleted. Archive hides it instead.
          </Text>
        ) : rule === 'keep' ? (
          <Text variant="caption" tone="secondary">
            Your only template can’t be removed.
          </Text>
        ) : null}
      </Card>

      {editing ? (
        <BlockEditSheet
          key={editing.key}
          visible
          onClose={() => setEditing(null)}
          templateId={t.id}
          block={editing.block}
          blocks={blocks as BlockLike[]}
        />
      ) : null}
    </Screen>
  );
}

function MoveButton(props: {
  label: string;
  disabled: boolean;
  icon: 'up' | 'down';
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const Icon = props.icon === 'up' ? ArrowUp : ArrowDown;
  return (
    <PressableScale
      accessibilityLabel={props.label}
      disabled={props.disabled}
      onPress={props.onPress}
      style={[
        styles.move,
        { backgroundColor: colors.recessed, opacity: props.disabled ? 0.35 : 1 },
      ]}
    >
      <Icon size={16} color={colors.text} strokeWidth={2} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  reorderRow: { flexDirection: 'row', justifyContent: 'flex-end' },
  blockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
    minHeight: 56,
  },
  blockMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  time: { width: 64 },
  flex: { flex: 1, minWidth: 0, gap: 2 },
  moves: { flexDirection: 'row', gap: 4 },
  move: { width: 40, height: 40, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  days: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  actions: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
});
