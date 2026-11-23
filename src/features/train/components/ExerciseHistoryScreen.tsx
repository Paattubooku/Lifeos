import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { useNow } from '@/features/today/hooks/useNow';
import { useToday } from '@/features/today/hooks/useToday';
import { dayMonth } from '@/features/today/lib/present';
import { addDays } from '@/lib/dates';
import { formatIndianNumber } from '@/lib/format';
import { Card, EmptyState, Screen, StatTile, Text, useTheme } from '@/ui';
import { Dumbbell } from 'lucide-react-native';

import { useGetExerciseSetsQuery } from '../api';
import { useTrain } from '../hooks/useTrain';
import { changePct, exerciseHistory } from '../lib/overload';
import { setsText } from '../lib/session';
import { TrendChart } from './TrendChart';

const n = (v: number | string | null) => Number(v ?? 0);

/** `/exercise/[id]` (Train-History): best set, est. 1RM, 8-week change, trend, sessions table. */
export function ExerciseHistoryScreen({ id, now: fixedNow }: { id: string; now?: number }) {
  const ticking = useNow(60_000);
  const now = fixedNow ?? ticking;
  const router = useRouter();
  const { colors } = useTheme();
  const t = useToday(now);
  const train = useTrain(t);
  const q = useGetExerciseSetsQuery(id);
  const ex = train.exercises.get(id);
  // Server history + this phone's unsynced sets for the exercise.
  const local = train.logs.filter((l) => l.exercise_id === id);
  const all = [
    ...(q.data ?? []).filter((r) => !local.some((l) => l.client_id === r.client_id)),
    ...local,
  ];
  const history = exerciseHistory(all, id);
  const back = { label: 'Train', onPress: () => router.back() };

  if (history.length === 0) {
    return (
      <Screen title={ex?.name ?? 'Exercise'} withTabBar={false} back={back}>
        <EmptyState
          icon={Dumbbell}
          title="No sets logged yet"
          body="History builds up after your first session with this exercise."
        />
      </Screen>
    );
  }

  const best = history.reduce((b, h) => (h.e1rm > b.e1rm ? h : b));
  const latest = history[0]!;
  const change = changePct(history, t.today, addDays(t.today, -56));
  const chrono = [...history].reverse();
  const weighted = best.e1rm > 0;

  return (
    <Screen
      title={ex?.name ?? 'Exercise'}
      subtitle={`${history.length} session${history.length === 1 ? '' : 's'} · since ${dayMonth(chrono[0]!.date)}${weighted ? ' · per hand' : ''}`}
      withTabBar={false}
      back={back}
    >
      <View style={styles.tiles}>
        <StatTile
          label="Best set"
          accent="success"
          value={
            weighted
              ? `${n(best.best.weight_kg)} × ${best.best.reps ?? 0}`
              : String(best.best.reps ?? best.best.duration_sec ?? 0)
          }
          sub={weighted ? 'kg × reps' : 'reps'}
          style={styles.flex}
        />
        <StatTile
          label="Est. 1RM"
          accent="primary"
          value={weighted ? latest.e1rm.toFixed(1) : '—'}
          sub={weighted ? 'kg per hand' : 'bodyweight'}
          style={styles.flex}
        />
        <StatTile
          label="8-wk change"
          value={change === null ? '—' : `${change > 0 ? '+' : ''}${change}%`}
          sub="est. 1RM"
          style={styles.flex}
        />
      </View>

      {weighted ? (
        <Card kicker="Best set trend">
          <Text variant="caption" tone="secondary" style={styles.corner}>
            est. 1RM, Epley
          </Text>
          <TrendChart
            unit="kg"
            accessibilityLabel={`Best set trend, estimated 1RM from ${chrono[0]!.e1rm} to ${latest.e1rm} kg`}
            points={chrono.map((h) => ({
              label: dayMonth(h.date).split(' ')[0]!,
              value: h.e1rm,
              detail: `${n(h.best.weight_kg)} × ${h.best.reps ?? 0} on ${dayMonth(h.date)}`,
            }))}
          />
          <Text variant="caption" tone="secondary">
            Est. 1RM = weight × (1 + reps ÷ 30) of the day’s best set. Tap a point for its date.
          </Text>
        </Card>
      ) : null}

      <Card kicker="Sessions" padding={14} gap={0} testID="history-table">
        <View style={[styles.row, styles.head]}>
          <Text variant="caption" tone="secondary" style={styles.date}>
            DATE
          </Text>
          <Text variant="caption" tone="secondary" style={styles.flex}>
            {weighted ? 'SETS (KG × REPS)' : 'SETS'}
          </Text>
          <Text variant="caption" tone="secondary">
            BEST
          </Text>
        </View>
        {history.map((h) => (
          <View
            key={h.date}
            style={[styles.row, { borderTopWidth: 1, borderColor: colors.hairline }]}
          >
            <Text variant="sub" weight={700} style={styles.date}>
              {dayMonth(h.date)}
            </Text>
            <Text variant="caption" tone="secondary" style={styles.flex}>
              {setsText(h.sets)}
            </Text>
            <View style={styles.right}>
              <Text variant="sub" weight={700} num>
                {weighted ? `${n(h.best.weight_kg)}×${h.best.reps ?? 0}` : String(h.best.reps ?? 0)}
              </Text>
              {h.volume > 0 ? (
                <Text
                  variant="caption"
                  tone="secondary"
                  num
                >{`${formatIndianNumber(h.volume)} kg`}</Text>
              ) : null}
            </View>
          </View>
        ))}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  tiles: { flexDirection: 'row', gap: 8 },
  flex: { flex: 1, minWidth: 0 },
  corner: { position: 'absolute', right: 16, top: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10 },
  head: { paddingTop: 4 },
  date: { width: 64 },
  right: { alignItems: 'flex-end' },
});
