import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronUp,
  Plus,
  Repeat,
  Search,
  X,
} from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { applyChanges } from '@/features/routine/slice';
import { useNow } from '@/features/today/hooks/useNow';
import { useToday } from '@/features/today/hooks/useToday';
import { newClientId } from '@/lib/ids';
import { useAppDispatch } from '@/store';
import {
  Button,
  Card,
  Chip,
  NumberStepper,
  Screen,
  Sheet,
  Text,
  TextField,
  useSnackbar,
  useTheme,
} from '@/ui';

import { useTrain } from '../hooks/useTrain';
import {
  draftSummary,
  type DraftItem,
  LIMITS,
  newDraft,
  planDayEdit,
  REST_CHOICES,
  toDraft,
  validate,
} from '../lib/editor';
import {
  estMinutes,
  type ExerciseRow,
  isTimed,
  itemsOf,
  plannedSets,
  type WorkoutItem,
} from '../lib/program';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function ExercisePicker({
  exercises,
  onPick,
  onClose,
  title,
}: {
  exercises: readonly ExerciseRow[];
  onPick: (id: string) => void;
  onClose: () => void;
  title: string;
}) {
  const { height } = useWindowDimensions();
  const { colors } = useTheme();
  const [q, setQ] = useState('');
  const term = q.trim().toLowerCase();
  const list = exercises.filter(
    (e) => !term || e.name.toLowerCase().includes(term) || e.muscle.toLowerCase().includes(term),
  );
  return (
    <Sheet visible onClose={onClose} title={title} testID="exercise-picker">
      <TextField
        label="Search"
        icon={Search}
        value={q}
        onChangeText={setQ}
        placeholder="Name or muscle"
      />
      <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: height * 0.5 }}>
        {list.map((e, i) => (
          <Pressable
            key={e.id}
            onPress={() => onPick(e.id)}
            accessibilityRole="button"
            accessibilityLabel={`${e.name}, ${e.muscle}`}
            style={[
              styles.pick,
              i > 0 ? { borderTopWidth: 1, borderColor: colors.hairline } : null,
            ]}
          >
            <Text variant="body" weight={600}>
              {e.name}
            </Text>
            <Text variant="caption" tone="secondary">{`${e.muscle} · ${e.equipment}`}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </Sheet>
  );
}

/** `/program-day/[id]` (Train-ProgramEditor design, PRD F23): sets, reps, rest, swap, add, remove. */
export function ProgramEditScreen({ now: fixedNow, dayId }: { now?: number; dayId?: string } = {}) {
  const params = useLocalSearchParams<{ id?: string }>();
  const id = dayId ?? params.id ?? '';
  const ticking = useNow(60_000);
  const now = fixedNow ?? ticking;
  const router = useRouter();
  const dispatch = useAppDispatch();
  const showSnackbar = useSnackbar();
  const { colors } = useTheme();
  const t = useToday(now);
  const train = useTrain(t);
  const day = train.program.days.find((d) => d.id === id);
  const original = itemsOf(train.program.items, id);
  const [draft, setDraft] = useState<DraftItem[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [picking, setPicking] = useState<{ swap: string | null } | null>(null);
  const rows = draft ?? toDraft(original);
  const errors = validate(rows);
  const exName = (eid: string) => train.exercises.get(eid)?.name ?? 'Exercise';
  const asItems: WorkoutItem[] = rows.map((r, sort) => ({ ...r, workout_day_id: id, sort }));
  const changes = planDayEdit(id, original, rows);

  const edit = (key: string, patch: Partial<DraftItem>) =>
    setDraft(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const move = (i: number, by: -1 | 1) => {
    const next = [...rows];
    const [x] = next.splice(i, 1);
    next.splice(i + by, 0, x!);
    setDraft(next);
  };
  const save = () => {
    if (errors.size) return;
    if (changes.length) void dispatch(applyChanges(changes));
    showSnackbar({ message: changes.length ? `${day?.title ?? 'Day'} saved` : 'No changes' });
    router.back();
  };

  if (!day)
    return (
      <Screen
        title="Edit day"
        withTabBar={false}
        back={{ label: 'Program', onPress: () => router.back() }}
      >
        <Text variant="sub" tone="secondary">
          This day isn’t in your program.
        </Text>
      </Screen>
    );

  return (
    <Screen
      title={`Edit ${day.title}`}
      subtitle={`${DAYS[day.weekday - 1]} · ${rows.length} exercises · ${plannedSets(asItems)} sets · ~${estMinutes(asItems)} min`}
      withTabBar={false}
      back={{ label: 'Program', onPress: () => router.back() }}
      action={
        <Button
          size="sm"
          variant="secondary"
          label="Done"
          accessibilityLabel="Done: save and go back"
          onPress={save}
          disabled={errors.size > 0}
        />
      }
    >
      {rows.map((r, i) => {
        const expanded = open === r.key;
        const timed = isTimed(r);
        return (
          <Card
            key={r.key}
            padding={14}
            gap={10}
            testID={`edit-${r.key}`}
            style={expanded ? { borderColor: colors.accents.primary.base } : undefined}
          >
            <View style={styles.row}>
              <Pressable
                style={styles.flex}
                onPress={() => setOpen(expanded ? null : r.key)}
                accessibilityRole="button"
                accessibilityState={{ expanded }}
                accessibilityLabel={`${exName(r.exercise_id)}, ${draftSummary(r)}. ${expanded ? 'Collapse' : 'Edit'}`}
              >
                <Text variant="body" weight={700}>
                  {exName(r.exercise_id)}
                </Text>
                <Text variant="caption" tone="secondary">
                  {draftSummary(r)}
                </Text>
              </Pressable>
              {expanded ? (
                <Pressable
                  onPress={() => {
                    setDraft(rows.filter((x) => x.key !== r.key));
                    setOpen(null);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${exName(r.exercise_id)}`}
                  style={styles.icon}
                >
                  <X size={18} color={colors.textSecondary} />
                </Pressable>
              ) : expanded ? null : (
                <ChevronDown size={18} color={colors.textSecondary} />
              )}
              {expanded ? <ChevronUp size={18} color={colors.textSecondary} /> : null}
            </View>
            {expanded ? (
              <>
                <Text variant="sub" weight={600}>
                  Sets
                </Text>
                <NumberStepper
                  value={r.sets}
                  onChange={(sets) => edit(r.key, { sets })}
                  accessibilityLabel={`${exName(r.exercise_id)} sets`}
                  min={LIMITS.sets[0]}
                  max={LIMITS.sets[1]}
                />
                {timed ? (
                  <>
                    <Text variant="sub" weight={600}>
                      Hold (seconds)
                    </Text>
                    <NumberStepper
                      value={r.duration_sec ?? 30}
                      onChange={(duration_sec) => edit(r.key, { duration_sec })}
                      accessibilityLabel={`${exName(r.exercise_id)} seconds`}
                      step={5}
                      min={LIMITS.seconds[0]}
                      max={LIMITS.seconds[1]}
                      unit="s"
                    />
                  </>
                ) : (
                  <>
                    <Text variant="sub" weight={600}>
                      Rep range
                    </Text>
                    <View style={styles.row}>
                      <View style={styles.flex}>
                        <NumberStepper
                          value={r.rep_min ?? 8}
                          onChange={(rep_min) => edit(r.key, { rep_min })}
                          accessibilityLabel={`${exName(r.exercise_id)} reps from`}
                          min={LIMITS.reps[0]}
                          max={LIMITS.reps[1]}
                        />
                      </View>
                      <Text variant="body">–</Text>
                      <View style={styles.flex}>
                        <NumberStepper
                          value={r.rep_max ?? 12}
                          onChange={(rep_max) => edit(r.key, { rep_max })}
                          accessibilityLabel={`${exName(r.exercise_id)} reps to`}
                          min={LIMITS.reps[0]}
                          max={LIMITS.reps[1]}
                        />
                      </View>
                    </View>
                  </>
                )}
                <Text variant="sub" weight={600}>
                  Rest
                </Text>
                <View style={styles.chips}>
                  {REST_CHOICES.map((s) => (
                    <Chip
                      key={s}
                      label={`${s} s`}
                      selected={r.rest_sec === s}
                      accessibilityLabel={`Rest ${s} seconds`}
                      onPress={() => edit(r.key, { rest_sec: s })}
                    />
                  ))}
                </View>
                {errors.get(r.key) ? (
                  <Text variant="caption" style={{ color: colors.accents.danger.base }}>
                    {errors.get(r.key)}
                  </Text>
                ) : null}
                <View style={styles.row}>
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={Repeat}
                    label="Swap exercise"
                    accessibilityLabel={`Swap ${exName(r.exercise_id)}`}
                    onPress={() => setPicking({ swap: r.key })}
                  />
                  <View style={styles.flex} />
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={ArrowUp}
                    label="Up"
                    accessibilityLabel={`Move ${exName(r.exercise_id)} up`}
                    disabled={i === 0}
                    onPress={() => move(i, -1)}
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={ArrowDown}
                    label="Down"
                    accessibilityLabel={`Move ${exName(r.exercise_id)} down`}
                    disabled={i === rows.length - 1}
                    onPress={() => move(i, 1)}
                  />
                </View>
              </>
            ) : null}
          </Card>
        );
      })}

      <Button
        variant="outline"
        icon={Plus}
        label="Add exercise from library"
        accessibilityLabel="Add exercise from library"
        onPress={() => setPicking({ swap: null })}
      />
      <Text variant="caption" tone="secondary">
        {`Estimated time updates live: ${plannedSets(asItems)} sets ≈ ${estMinutes(asItems)} min. Overload suggestions keep working (F12).`}
      </Text>
      <Button
        label={`Save ${day.title}`}
        accessibilityLabel={`Save ${day.title}`}
        fullWidth
        disabled={errors.size > 0}
        onPress={save}
      />

      {picking ? (
        <ExercisePicker
          title={picking.swap ? 'Swap for' : 'Add exercise'}
          exercises={train.program.exercises}
          onClose={() => setPicking(null)}
          onPick={(eid) => {
            if (picking.swap) edit(picking.swap, { exercise_id: eid });
            else {
              const d = newDraft(eid, { clientId: newClientId(), id: newClientId() });
              setDraft([...rows, d]);
              setOpen(d.key);
            }
            setPicking(null);
          }}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flex: { flex: 1 },
  icon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pick: { paddingVertical: 10, gap: 2 },
});
