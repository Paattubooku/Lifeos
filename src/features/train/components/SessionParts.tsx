import { CheckCircle2, Timer } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { shortDay } from '@/features/today/lib/present';
import { istClock } from '@/lib/dates';
import { formatClock, formatIndianNumber } from '@/lib/format';
import { Banner, Button, Card, Ring, StatTile, Text, useTheme } from '@/ui';

import { type ExerciseRow, shortName, type WorkoutItem } from '../lib/program';
import { type SessionRow, type SetLogRow, setsOf, setsText, volume } from '../lib/session';
import { DONE_PCT } from '../lib/week';

export const mmss = (sec: number) => {
  const s = Math.max(0, Math.ceil(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/** Exercise strip: done (green), current (blue), to do. */
export function ExerciseTabs({
  items,
  exercises,
  logs,
  sessionId,
  current,
  onPick,
}: {
  items: readonly WorkoutItem[];
  exercises: ReadonlyMap<string, ExerciseRow>;
  logs: readonly SetLogRow[];
  sessionId: string;
  current: number;
  onPick: (i: number) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.tabs} accessibilityRole="tablist">
      {items.map((i, n) => {
        const done = setsOf(logs, sessionId, i.exercise_id).length >= i.sets;
        const color =
          n === current
            ? colors.accents.primary.base
            : done
              ? colors.accents.success.base
              : colors.recessed;
        const name = shortName(exercises.get(i.exercise_id)?.name ?? 'Exercise');
        return (
          <Text
            key={i.id}
            onPress={() => onPick(n)}
            accessibilityRole="tab"
            accessibilityState={{ selected: n === current }}
            accessibilityLabel={`${name}${done ? ', done' : ''}`}
            style={[styles.tab, { borderTopColor: color }]}
            variant="caption"
            weight={600}
            tone={n === current ? 'primary' : 'secondary'}
            numberOfLines={1}
          >
            {name}
          </Text>
        );
      })}
    </View>
  );
}

/** Rest between sets (Train-RestTimer): ring countdown, +15 s, skip, what's next. */
export function RestView({
  left,
  total,
  next,
  onAdd,
  onSkip,
}: {
  left: number;
  total: number;
  next: string;
  onAdd: () => void;
  onSkip: () => void;
}) {
  return (
    <View style={styles.center} testID="rest-view">
      <Ring
        size={240}
        strokeWidth={14}
        accent="primary"
        progress={total > 0 ? left / total : 0}
        accessibilityLabel={`Rest ${mmss(left)} left`}
      >
        <View style={styles.ringText}>
          <Text variant="kicker" tone="secondary">
            Rest
          </Text>
          <Text variant="hero" num>
            {mmss(left)}
          </Text>
          <Text variant="sub" tone="secondary">{`of ${mmss(total)}`}</Text>
        </View>
      </Ring>
      <View style={styles.row}>
        <Button
          variant="secondary"
          label="+15 s"
          accessibilityLabel="Add 15 seconds"
          onPress={onAdd}
          style={styles.flex}
        />
        <Button
          label="Skip rest"
          accessibilityLabel="Skip rest"
          onPress={onSkip}
          style={styles.flex}
        />
      </View>
      <Text variant="caption" tone="secondary" align="center">
        The phone rings when rest is over, even locked.
      </Text>
      <Card kicker="Up next" style={styles.full}>
        <Text variant="heading">{next}</Text>
      </Card>
    </View>
  );
}

/** Session finished (Train-Summary, without F12's records). */
export function SummaryView({
  title,
  session,
  items,
  exercises,
  logs,
  onDone,
}: {
  title: string;
  session: SessionRow;
  items: readonly WorkoutItem[];
  exercises: ReadonlyMap<string, ExerciseRow>;
  logs: readonly SetLogRow[];
  onDone: () => void;
}) {
  const { colors } = useTheme();
  const pct = session.completion ?? 0;
  const mine = logs.filter((l) => l.session_id === session.id);
  const minutes =
    session.started_at && session.finished_at
      ? Math.max(
          1,
          Math.round((Date.parse(session.finished_at) - Date.parse(session.started_at)) / 60000),
        )
      : null;
  const planned = items.reduce((s, i) => s + i.sets, 0);
  return (
    <View style={styles.gap} testID="summary">
      <View style={styles.center}>
        <Ring
          size={180}
          strokeWidth={14}
          accent="primary"
          progress={pct / 100}
          accessibilityLabel={`Completion ${pct}%`}
        >
          <View style={styles.ringText}>
            <Text variant="hero" num>{`${pct}%`}</Text>
            <Text variant="caption" tone="secondary">
              completion
            </Text>
          </View>
        </Ring>
        <Text variant="title" align="center">{`${title} done`}</Text>
        <Text variant="sub" tone="secondary" align="center">
          {[
            shortDay(session.date),
            session.started_at && session.finished_at
              ? `${formatClock(istClock(session.started_at))} → ${formatClock(istClock(session.finished_at))}`
              : null,
            minutes ? `${minutes} min` : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </Text>
      </View>
      {pct >= DONE_PCT ? (
        <Banner
          tone="success"
          icon={CheckCircle2}
          title="Workout block ticked on Today"
          body={`${pct}% ≥ ${DONE_PCT}% of planned sets.`}
          testID="ticked"
        />
      ) : (
        <Banner
          tone="info"
          icon={Timer}
          title={`${pct}% — under ${DONE_PCT}%`}
          body="Today’s workout block isn’t ticked; tick it by hand if you count it."
        />
      )}
      <View style={styles.row}>
        <StatTile
          label="Volume"
          accent="protein"
          value={formatIndianNumber(Math.round(volume(mine)))}
          sub="kg"
          style={styles.flex}
        />
        <StatTile
          label="Sets"
          value={`${Math.min(mine.length, planned)} / ${planned}`}
          sub="logged"
          style={styles.flex}
        />
        <StatTile
          label="Time"
          accent="success"
          value={minutes ? String(minutes) : '—'}
          sub="min"
          style={styles.flex}
        />
      </View>
      <Card kicker="Per exercise">
        {items.map((i) => {
          const sets = setsOf(logs, session.id, i.exercise_id);
          const p = Math.round((Math.min(sets.length, i.sets) / i.sets) * 100);
          return (
            <View key={i.id} style={[styles.exRow, { borderTopColor: colors.hairline }]}>
              <View style={styles.flex}>
                <Text variant="body" weight={700}>
                  {exercises.get(i.exercise_id)?.name ?? 'Exercise'}
                </Text>
                <Text variant="caption" tone="secondary">
                  {sets.length ? setsText(sets) : 'Not logged'}
                </Text>
              </View>
              <Text
                variant="sub"
                weight={700}
                tone={p >= 100 ? 'success' : p >= DONE_PCT ? 'default' : 'calories'}
              >{`${p}%`}</Text>
            </View>
          );
        })}
        <Text variant="caption" tone="secondary">
          Completion = sets logged ÷ sets planned.
        </Text>
      </Card>
      <Button label="Done" accessibilityLabel="Done" onPress={onDone} fullWidth size="lg" />
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', gap: 4 },
  tab: { flex: 1, borderTopWidth: 3, paddingTop: 6 },
  center: { alignItems: 'center', gap: 16 },
  ringText: { alignItems: 'center' },
  row: { flexDirection: 'row', gap: 10, alignSelf: 'stretch' },
  flex: { flex: 1 },
  full: { alignSelf: 'stretch' },
  gap: { gap: 16 },
  exRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, paddingTop: 10 },
});
