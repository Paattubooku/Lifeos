import { useRouter } from 'expo-router';
import { Check, ChevronRight, Clock, Dumbbell, Moon, Play, X } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { hhmm } from '@/features/routine/lib/blocks';
import { useNow } from '@/features/today/hooks/useNow';
import { useToday } from '@/features/today/hooks/useToday';
import { dayKicker, shortDay } from '@/features/today/lib/present';
import { addDays, istClock, isoWeekday } from '@/lib/dates';
import { formatClock, formatIndianNumber } from '@/lib/format';
import { Button, Card, EmptyState, Screen, StatTile, StatusChip, Text, useTheme } from '@/ui';

import { useTrain } from '../hooks/useTrain';
import { useTrainActions } from '../hooks/useTrainActions';
import { estMinutes, plannedSets, targetText } from '../lib/program';
import { volume } from '../lib/session';
import { DONE_PCT, lastSevenDays, type WeekDay, weekSummary, thisWeek } from '../lib/week';

const DOW = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

/** Train tab (Train-Tab / WalkDay / RestDay designs). */
export function TrainScreen({ now: fixedNow }: { now?: number } = {}) {
  const ticking = useNow();
  const now = fixedNow ?? ticking;
  const router = useRouter();
  const { colors } = useTheme();
  const t = useToday(now);
  const train = useTrain(t);
  const actions = useTrainActions();
  const { day, items } = train.dayOf(t.today);
  const session = train.sessionOn(t.today);
  const live = session && !session.deleted_at ? session : null;
  const block = t.plan.blocks.find((b) => b.kind === 'workout');
  const kicker = `${dayKicker(t.today, isoWeekday(t.today), 0, 0).split(' · ')[0]} · ${formatClock(istClock(now)).toUpperCase()}`;
  const last7 = lastSevenDays(t.today, t.programCtx, train.sessions);
  const week = weekSummary(thisWeek(t.today, t.programCtx, train.sessions));
  const weekLogs = train.logs.filter((l) => l.date > addDays(t.today, -7));
  const open = () => router.push({ pathname: '/session/[date]', params: { date: t.today } });

  const todayCard = (() => {
    if (!t.programCtx.program) {
      return (
        <EmptyState
          icon={Dumbbell}
          title="No active program"
          body="The default program is created at sign-in."
        />
      );
    }
    if (!day) {
      const start = (t.programCtx.program as { start_date: string | null }).start_date;
      return (
        <EmptyState
          icon={Dumbbell}
          title={
            start && start > t.today ? `Program starts ${shortDay(start)}` : 'No session today'
          }
          body="Sessions follow the program’s weekdays."
        />
      );
    }
    const chip = (
      <StatusChip
        label={`TODAY${block ? ` · ${formatClock(hhmm(block.start_time)).toUpperCase()}` : ''}`}
        tone="primary"
        beacon
      />
    );
    if (day.kind === 'rest') {
      return (
        <View style={styles.gap}>
          {chip}
          <View style={styles.titleRow}>
            <View style={[styles.icon, { backgroundColor: colors.recessed }]}>
              <Moon size={22} color={colors.textSecondary} strokeWidth={2} />
            </View>
            <View style={styles.flex}>
              <Text variant="title">Rest day</Text>
              <Text variant="sub" tone="secondary">
                Nothing to do. The workout block counts as done.
              </Text>
            </View>
          </View>
        </View>
      );
    }
    if (day.kind === 'walk') {
      const minutes = estMinutes(items);
      const done = (live?.completion ?? 0) >= DONE_PCT;
      return (
        <View style={styles.gap}>
          {chip}
          <View style={styles.titleRow}>
            <View style={[styles.icon, { backgroundColor: colors.accents.success.tint }]}>
              <Clock size={22} color={colors.accents.success.base} strokeWidth={2} />
            </View>
            <View style={styles.flex}>
              <Text variant="title">Brisk walk</Text>
              <Text variant="sub" tone="secondary">{`${minutes} min · no weights`}</Text>
            </View>
          </View>
          <Text variant="sub" tone="secondary">
            A pace where talking takes effort.
          </Text>
          {done ? (
            <Text variant="sub" tone="success" weight={700}>
              Done · walk logged
            </Text>
          ) : (
            <Button
              icon={Check}
              label={`Done (${minutes} min)`}
              accessibilityLabel={`Walk done, ${minutes} minutes`}
              onPress={() => void actions.walkDone(t.today, day.id, session)}
              fullWidth
              size="lg"
            />
          )}
        </View>
      );
    }
    const finished = Boolean(live?.finished_at);
    const started = Boolean(live?.started_at);
    return (
      <View style={styles.gap}>
        <View style={styles.between}>
          {chip}
          {live?.completion ? (
            <Text variant="sub" tone="secondary">{`${live.completion}% logged`}</Text>
          ) : null}
        </View>
        <View style={styles.titleRow}>
          <View style={[styles.icon, { backgroundColor: colors.accents.protein.tint }]}>
            <Dumbbell size={22} color={colors.accents.protein.base} strokeWidth={2} />
          </View>
          <View style={styles.flex}>
            <Text variant="title">{day.title}</Text>
            <Text variant="sub" tone="secondary">
              {day.kind === 'circuit'
                ? `${items.length} stations · ${items[0]?.sets ?? day.rounds ?? 0} rounds · ~${estMinutes(items)} min`
                : `${items.length} exercises · ~${estMinutes(items)} min · ${plannedSets(items)} sets`}
            </Text>
          </View>
        </View>
        {items.map((i, n) => (
          <View key={i.id} style={[styles.exRow, { borderTopColor: colors.hairline }]}>
            <Text variant="sub" tone="secondary" style={styles.num}>
              {String(n + 1)}
            </Text>
            <Text variant="body" style={styles.flex}>
              {train.exercises.get(i.exercise_id)?.name ?? 'Exercise'}
            </Text>
            <Text variant="sub" tone="secondary" num>
              {targetText(i, train.exercises.get(i.exercise_id))}
            </Text>
          </View>
        ))}
        <Button
          icon={finished ? Check : Play}
          label={
            finished
              ? `${day.title} done · ${live?.completion ?? 0}%`
              : `${started ? 'Resume' : 'Start'} ${day.title}`
          }
          accessibilityLabel={
            finished ? `View ${day.title} summary` : `${started ? 'Resume' : 'Start'} ${day.title}`
          }
          variant={finished ? 'secondary' : 'primary'}
          onPress={open}
          fullWidth
          size="lg"
        />
      </View>
    );
  })();

  return (
    <Screen title="Train" kicker={kicker}>
      <Card
        testID="train-today"
        style={
          day && day.kind !== 'rest'
            ? { borderColor: colors.accents.primary.base, borderWidth: 1.5 }
            : undefined
        }
      >
        {todayCard}
      </Card>

      <Card kicker="Last 7 days" testID="train-week">
        <Text variant="caption" tone="secondary" style={styles.corner}>
          {`${weekSummary(last7).done} of ${weekSummary(last7).planned} sessions${
            weekSummary(last7).missed.length
              ? ` · ${weekSummary(last7)
                  .missed.map(
                    (d) =>
                      DOW[isoWeekday(d.date) - 1]!.slice(0, 1) +
                      DOW[isoWeekday(d.date) - 1]!.slice(1).toLowerCase(),
                  )
                  .join(', ')} missed`
              : ''
          }`}
        </Text>
        <View style={styles.week}>
          {last7.map((d) => (
            <DayDot key={d.date} d={d} />
          ))}
        </View>
      </Card>

      <View style={styles.tiles}>
        <StatTile
          label="This week"
          accent="protein"
          value={`${week.done} / ${week.planned}`}
          sub="sessions"
          style={styles.flex}
        />
        <StatTile
          label="Volume · 7 d"
          value={formatIndianNumber(Math.round(volume(weekLogs)))}
          sub="kg"
          style={styles.flex}
        />
        <StatTile
          label="Sets · 7 d"
          accent="success"
          value={String(weekLogs.length)}
          sub="logged"
          style={styles.flex}
        />
      </View>

      <Card
        onPress={() => router.push('/program')}
        accessibilityLabel="Program. Open"
        testID="link-program"
      >
        <LinkRow
          icon={Dumbbell}
          title="Program"
          sub={`${train.program.days.filter((d) => d.kind !== 'rest').length} training days + rest`}
        />
      </Card>
      <Card onPress={() => router.push('/exercises')} accessibilityLabel="Exercise library. Open">
        <LinkRow
          icon={Dumbbell}
          title="Exercise library"
          sub={`${train.program.exercises.length} exercises`}
        />
      </Card>
    </Screen>
  );
}

function DayDot({ d }: { d: WeekDay }) {
  const { colors } = useTheme();
  const success = colors.accents.success.base;
  const danger = colors.accents.danger.base;
  const primary = colors.accents.primary.base;
  const dow = DOW[isoWeekday(d.date) - 1]!;
  const circle =
    d.state === 'done' ? (
      <View style={[styles.dot, { backgroundColor: success, borderColor: success }]}>
        <Check size={14} color={colors.onButton} strokeWidth={3} />
      </View>
    ) : d.state === 'missed' ? (
      <View style={[styles.dot, { borderColor: danger }]}>
        <X size={14} color={danger} strokeWidth={2.5} />
      </View>
    ) : d.state === 'rest' ? (
      <View
        style={[styles.dot, { borderColor: colors.recessed, backgroundColor: colors.recessed }]}
      >
        <Moon size={12} color={colors.textSecondary} strokeWidth={2} />
      </View>
    ) : d.state === 'today' ? (
      <View style={[styles.dot, { backgroundColor: primary, borderColor: primary }]}>
        <View style={[styles.inner, { backgroundColor: colors.onButton }]} />
      </View>
    ) : (
      <View style={[styles.dot, { borderColor: colors.border }]} />
    );
  return (
    <View
      style={styles.day}
      accessible
      accessibilityLabel={`${dow} ${Number(d.date.slice(8))}: ${d.title}, ${d.state}`}
    >
      <Text variant="caption" tone="secondary" weight={600}>
        {dow}
      </Text>
      <Text variant="sub" weight={700} num>
        {String(Number(d.date.slice(8)))}
      </Text>
      {circle}
      <Text
        variant="caption"
        tone={d.state === 'missed' ? 'danger' : d.state === 'today' ? 'primary' : 'secondary'}
        numberOfLines={1}
      >
        {d.title.replace('Full Body ', '')}
      </Text>
    </View>
  );
}

function LinkRow({
  icon: Icon,
  title,
  sub,
}: {
  icon: typeof Dumbbell;
  title: string;
  sub: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.titleRow}>
      <View style={[styles.linkIcon, { backgroundColor: colors.accents.primary.tint }]}>
        <Icon size={18} color={colors.accents.primary.base} strokeWidth={2} />
      </View>
      <View style={styles.flex}>
        <Text variant="body" weight={700}>
          {title}
        </Text>
        <Text variant="caption" tone="secondary">
          {sub}
        </Text>
      </View>
      <ChevronRight size={18} color={colors.textSecondary} strokeWidth={2} />
    </View>
  );
}

const styles = StyleSheet.create({
  gap: { gap: 12 },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  linkIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: { flex: 1, minWidth: 0 },
  exRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: 1, paddingTop: 10 },
  num: { width: 16 },
  corner: { position: 'absolute', right: 16, top: 16 },
  week: { flexDirection: 'row', justifyContent: 'space-between' },
  day: { flex: 1, alignItems: 'center', gap: 4 },
  dot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inner: { width: 8, height: 8, borderRadius: 4 },
  tiles: { flexDirection: 'row', gap: 8 },
});
