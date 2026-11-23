import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { useNow } from '@/features/today/hooks/useNow';
import { useToday } from '@/features/today/hooks/useToday';
import { isoWeekday } from '@/lib/dates';
import { Card, Screen, StatTile, StatusChip, Text, useTheme } from '@/ui';

import { useTrain } from '../hooks/useTrain';
import { estMinutes, itemsOf, plannedSets } from '../lib/program';

const DOW = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

/** Program view (Train-Program): the week's days, exercises, sets and time. Editing is F23. */
export function ProgramScreen({ now: fixedNow }: { now?: number } = {}) {
  const ticking = useNow(60_000);
  const now = fixedNow ?? ticking;
  const router = useRouter();
  const { colors } = useTheme();
  const t = useToday(now);
  const train = useTrain(t);
  const days = [...train.program.days].sort((a, b) => a.weekday - b.weekday);
  const training = days.filter((d) => d.kind === 'strength' || d.kind === 'circuit').length;
  const walks = days.filter((d) => d.kind === 'walk').length;
  const weekMin = days.reduce(
    (s, d) => s + (d.kind === 'rest' ? 0 : estMinutes(itemsOf(train.program.items, d.id))),
    0,
  );
  const today = isoWeekday(t.today);
  const accent = (kind: string) =>
    kind === 'walk'
      ? colors.accents.success.base
      : kind === 'circuit'
        ? colors.accents.calories.base
        : kind === 'rest'
          ? colors.textSecondary
          : colors.accents.protein.base;

  return (
    <Screen
      title="Program"
      subtitle="Dumbbell Beginner 5-Day"
      withTabBar={false}
      back={{ label: 'Train', onPress: () => router.back() }}
    >
      <View style={styles.tiles}>
        <StatTile
          label="Training days"
          accent="protein"
          value={`${training}${walks ? ' + walk' : ''}`}
          sub="per week"
          style={styles.flex}
        />
        <StatTile
          label="Time"
          value={`~${Math.floor(weekMin / 60)} h ${weekMin % 60} m`}
          sub="per week"
          style={styles.flex}
        />
        <StatTile label="Equipment" value="DB + bench" sub="up to 20 kg" style={styles.flex} />
      </View>
      {days.map((d) => {
        const items = itemsOf(train.program.items, d.id);
        const names = items
          .map((i) => train.exercises.get(i.exercise_id)?.name ?? '')
          .filter(Boolean);
        const isToday = d.weekday === today;
        return (
          <Card
            key={d.id}
            testID={`program-${d.weekday}`}
            style={
              isToday ? { borderColor: colors.accents.primary.base, borderWidth: 1.5 } : undefined
            }
          >
            <View style={styles.row}>
              <View style={styles.dow}>
                <Text variant="caption" tone={isToday ? 'primary' : 'secondary'} weight={700}>
                  {DOW[d.weekday - 1]}
                </Text>
                <View style={[styles.dot, { backgroundColor: accent(d.kind) }]} />
              </View>
              <View style={styles.flex}>
                <View style={styles.titleRow}>
                  <Text variant="heading">{d.title}</Text>
                  {isToday ? <StatusChip label="TODAY" tone="primary" /> : null}
                </View>
                <Text variant="sub" tone="secondary" numberOfLines={2}>
                  {d.kind === 'rest' ? 'Nothing planned' : names.join(', ')}
                </Text>
                {d.kind === 'rest' ? null : (
                  <Text variant="caption" tone="secondary">
                    {d.kind === 'circuit'
                      ? `${items[0]?.sets ?? d.rounds ?? 0} rounds · ${items.length} stations · ~${estMinutes(items)} min`
                      : d.kind === 'walk'
                        ? `${estMinutes(items)} min`
                        : `${items.length} ex · ${plannedSets(items)} sets · ~${estMinutes(items)} min`}
                  </Text>
                )}
              </View>
            </View>
          </Card>
        );
      })}
      <Text variant="caption" tone="secondary">
        Editing the program (sets, reps, rest, swapping exercises) comes with Settings (F23).
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  tiles: { flexDirection: 'row', gap: 8 },
  flex: { flex: 1, minWidth: 0 },
  row: { flexDirection: 'row', gap: 12 },
  dow: { width: 36, alignItems: 'center', gap: 6, paddingTop: 4 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
