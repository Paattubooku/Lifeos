import { useRouter } from 'expo-router';
import { CalendarDays, ChevronDown } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { weightWrite } from '@/features/profile/lib/plan';
import { SwitchTemplateSheet } from '@/features/routine/components/SwitchTemplateSheet';
import { dayMinutes, hhmm } from '@/features/routine/lib/blocks';
import type { Change } from '@/features/routine/lib/changes';
import { applyChanges } from '@/features/routine/slice';
import { istClock, isoWeekday, logicalMoment } from '@/lib/dates';
import { formatClock } from '@/lib/format';
import { useFood } from '@/features/food/hooks/useFood';
import { useFoodActions } from '@/features/food/hooks/useFoodActions';
import { WaterAddSheet } from '@/features/water/components/WaterAddSheet';
import { WaterCard } from '@/features/water/components/WaterCard';
import { useLogWater } from '@/features/water/hooks/useLogWater';
import { useWater } from '@/features/water/hooks/useWater';
import { useAppDispatch } from '@/store';
import {
  Card,
  Chip,
  EmptyState,
  Fab,
  haptics,
  Screen,
  TAB_BAR_HEIGHT,
  useSnackbar,
  useTheme,
} from '@/ui';

import { useDayScoreSync } from '../hooks/useDayScoreSync';
import { useNow } from '../hooks/useNow';
import { useStreak } from '../hooks/useStreak';
import { useToday } from '../hooks/useToday';
import { type BlockStatus, planBlockStatus, planNote, planSleep, statusOf } from '../lib/changes';
import { mealSummary } from '../lib/meals';
import { canMoveToTomorrow, moveSummary, planMoveToTomorrow } from '../lib/program';
import { streakLine } from '../lib/streak';
import { dayKicker, type RowContext, rowTitle, shortDay } from '../lib/present';
import { formatMinutes, nowDayMinutes, endOf } from '../lib/timeline';
import { type DayRow, openRows, type SkipReason } from '../selectors';
import { EndOfDayCard, type EndOfDayItem } from './EndOfDayCard';
import { NoteSheet, SleepSheet, WeightSheet } from './LogSheets';
import { NowCard } from './NowCard';
import { ScoreCard } from './ScoreCard';
import { SkipSheet } from './SkipSheet';
import { Timeline } from './Timeline';

/** Event-time clock (kept out of render for the React Compiler). */
const clock = () => Date.now();

type Open = 'switch' | 'weight' | 'sleep' | 'note' | 'water' | null;

/** One screen that runs the day (PRD F05). `now` is fixed in tests. */
export function TodayScreen({ now: fixedNow }: { now?: number } = {}) {
  const ticking = useNow();
  const now = fixedNow ?? ticking;
  const t = useToday(now);
  const water = useWater(now);
  const food = useFood(now);
  const foodActions = useFoodActions(food);
  const { log: logWaterEntry } = useLogWater();
  useDayScoreSync(t);
  const { streak } = useStreak(t.today, t.plan.blocks.length > 0 ? t.day.score.score : null);
  const dispatch = useAppDispatch();
  const router = useRouter();
  const showSnackbar = useSnackbar();
  const { colors } = useTheme();
  const [open, setOpen] = useState<Open>(null);
  const [skipping, setSkipping] = useState<DayRow | null>(null);
  const insets = useSafeAreaInsets();

  // Undo runs later, against the rows as they are then.
  const latest = useRef(t);
  useEffect(() => {
    latest.current = t;
  });

  const logFor = (blockId: string, from = t) => {
    const rows = from.blockLogs.filter((l) => l.block_id === blockId);
    return rows.find((l) => !l.deleted_at) ?? rows[0] ?? null;
  };
  const apply = (changes: Change[]) => dispatch(applyChanges(changes));

  const setStatus = async (row: DayRow, next: BlockStatus, message: string) => {
    const before = statusOf(row.log);
    const blockId = row.block.id;
    const date = t.today;
    haptics.tap();
    await apply(planBlockStatus(blockId, date, logFor(blockId), next, clock()));
    showSnackbar({
      message,
      actionLabel: 'Undo',
      onAction: () =>
        void apply(
          planBlockStatus(blockId, date, logFor(blockId, latest.current), before, clock()),
        ),
    });
  };

  const ctx: RowContext = {
    nowMin: nowDayMinutes(now),
    session: t.session ? { title: t.session.title, kind: t.session.kind } : null,
    exercises: t.exercises,
    meal: (slot) => mealSummary(slot, t.food, t.mealPlan),
  };

  const onTap = (row: DayRow) => {
    const title = rowTitle(row, ctx.session);
    if (row.state === 'skipped') return setSkipping(row);
    if (row.log?.status === 'done') return void setStatus(row, null, `${title} not done`);
    if (row.auto.done) return showSnackbar({ message: `${title} is done automatically` });
    void setStatus(row, { status: 'done' }, `${title} done`);
  };

  const logWater = (ml: number) =>
    void logWaterEntry(ml, {
      today: water.today,
      totalBefore: water.totalMl,
      targetMl: water.targetMl,
    });

  const skip = async (reason: SkipReason, move: boolean) => {
    const row = skipping;
    setSkipping(null);
    if (!row) return;
    await setStatus(
      row,
      { status: 'skipped', reason },
      `${rowTitle(row, ctx.session)} skipped · ${reason}`,
    );
    if (move) await apply(planMoveToTomorrow(t.today, t.programCtx));
  };

  const header = {
    kicker: dayKicker(t.today, isoWeekday(t.today), t.day.score.done, t.day.score.counted),
    title: formatClock(istClock(now)),
  };
  const templateChip = (
    <Chip
      label={t.plan.template?.name ?? 'No template'}
      trailingIcon={ChevronDown}
      accessibilityLabel={`Template ${t.plan.template?.name ?? 'none'}. Switch template for today`}
      onPress={() => setOpen('switch')}
    />
  );

  if (t.isLoading && t.plan.blocks.length === 0) {
    return (
      <Screen title={header.title} kicker={header.kicker}>
        <ActivityIndicator color={colors.accents.primary.base} accessibilityLabel="Loading" />
      </Screen>
    );
  }

  const waters = t.plan.blocks.filter((b) => b.kind === 'water');
  const waterTarget = waters[waters.length - 1];
  const phoneOff = t.profile?.phone_off_time ? dayMinutes(t.profile.phone_off_time) : 21 * 60 + 30;
  const showEndOfDay = ctx.nowMin >= phoneOff && t.plan.blocks.length > 0;
  const sleepLogged = Boolean(t.sleep && !t.sleep.deleted_at);
  const weightLogged = Boolean(t.weightToday && !t.weightToday.deleted_at);
  const items: EndOfDayItem[] = [
    ...openRows(t.day.rows).map((r) => ({
      key: r.block.client_id,
      title: rowTitle(r, ctx.session),
      sub:
        ctx.nowMin >= endOf(r.block)
          ? `${formatMinutes(ctx.nowMin - endOf(r.block))} late`
          : `at ${formatClock(hhmm(r.block.start_time))}`,
    })),
    ...(weightLogged ? [] : [{ key: 'weight', title: 'Weight not logged' }]),
    ...(sleepLogged ? [] : [{ key: 'sleep', title: 'Sleep not logged' }]),
  ];

  const skipRow = skipping;
  return (
    <View style={styles.fill}>
      <Screen title={header.title} kicker={header.kicker} accessory={templateChip}>
        <ScoreCard
          score={t.day.score.score}
          done={t.day.score.done}
          counted={t.day.score.counted}
          waterMl={t.waterMl}
          waterTargetMl={t.waterTargetMl}
          proteinG={t.foodTotals.protein}
          proteinTargetG={t.profile?.protein_target_g ?? 150}
          streak={{
            current: streak.current,
            line: streakLine(streak, shortDay),
            onPress: () => router.push('/streaks'),
          }}
        />

        {t.plan.blocks.length === 0 ? (
          <Card>
            <EmptyState
              icon={CalendarDays}
              title="No routine for today"
              body="Give a template today’s weekday, or switch one in for today."
              action={{
                label: 'Open Routine',
                accessibilityLabel: 'Open Routine',
                onPress: () => router.push('/routine'),
              }}
            />
          </Card>
        ) : null}

        {showEndOfDay ? (
          <EndOfDayCard
            score={t.day.score.score}
            items={items}
            hasNote={Boolean(t.dayLog?.note)}
            onLogWeight={() => setOpen('weight')}
            onLogSleep={() => setOpen('sleep')}
            onNote={() => setOpen('note')}
          />
        ) : (
          <NowCard
            current={t.day.current}
            next={t.day.next}
            ctx={ctx}
            isWaterTarget={t.day.current?.block.client_id === waterTarget?.client_id}
            onDone={(row) => onTap(row)}
            onSkip={setSkipping}
            onLogWater={logWater}
            onEatMeal={(row) => {
              const meal = food.day.meals.find((m) => m.meal.slot === row.block.ref_slot);
              if (meal) void foodActions.eatMeal(meal);
            }}
          />
        )}

        <WaterCard
          totalMl={water.totalMl}
          targetMl={water.targetMl}
          pace={water.pace}
          targetTime={water.targetTime}
          wakeTime={water.wakeTime}
          beforeWake={water.beforeWake}
          onOpen={() => router.push('/water')}
          onDrink={logWater}
        />

        {t.plan.blocks.length > 0 ? (
          <Timeline
            rows={t.day.rows}
            ctx={ctx}
            nextId={t.day.next?.block.client_id ?? null}
            templateName={t.plan.template?.name ?? null}
            onTap={onTap}
            onLongPress={setSkipping}
          />
        ) : null}

        {skipRow ? (
          <SkipSheet
            key={skipRow.block.client_id}
            visible
            onClose={() => setSkipping(null)}
            title={rowTitle(skipRow, ctx.session)}
            startTime={skipRow.block.start_time}
            durationMin={skipRow.block.duration_min}
            skipped={skipRow.state === 'skipped'}
            initialReason={(skipRow.log?.skip_reason as SkipReason | null) ?? null}
            optional={skipRow.block.is_optional}
            moveSummary={
              skipRow.block.kind === 'workout' && canMoveToTomorrow(t.today, t.programCtx)
                ? moveSummary(t.today, t.programCtx)
                : null
            }
            onSkip={(reason, move) => void skip(reason, move)}
            onUnskip={() => {
              setSkipping(null);
              void setStatus(skipRow, null, `${rowTitle(skipRow, ctx.session)} unskipped`);
            }}
          />
        ) : null}

        {open === 'water' ? (
          <WaterAddSheet
            visible
            onClose={() => setOpen(null)}
            totalMl={water.totalMl}
            targetMl={water.targetMl}
            pace={water.pace}
            nowClock={istClock(now)}
            onAdd={(ml) => {
              setOpen(null);
              logWater(ml);
            }}
          />
        ) : null}
        {open === 'switch' ? <SwitchTemplateSheet visible onClose={() => setOpen(null)} /> : null}
        {open === 'weight' ? (
          <WeightSheet
            visible
            onClose={() => setOpen(null)}
            initialKg={t.latestWeightKg ?? t.profile?.start_weight_kg ?? 80}
            onSave={(kg) => {
              setOpen(null);
              const w = weightWrite(t.today, kg, t.weightToday ?? null);
              if (w)
                void apply([
                  {
                    op: 'upsert',
                    table: w.table,
                    row: w.row,
                    ...(w.clientId ? { clientId: w.clientId } : {}),
                  },
                ]);
              showSnackbar({ message: `${kg.toFixed(1)} kg logged` });
            }}
          />
        ) : null}
        {open === 'sleep' ? (
          <SleepSheet
            visible
            onClose={() => setOpen(null)}
            initialBed={hhmm(t.profile?.sleep_time ?? '22:00')}
            initialWake={hhmm(t.profile?.wake_time ?? '05:00')}
            onSave={(bed, wake) => {
              setOpen(null);
              void apply(
                planSleep(
                  t.today,
                  t.sleep,
                  logicalMoment(t.yesterday, bed),
                  logicalMoment(t.today, wake),
                ),
              );
              showSnackbar({ message: 'Sleep logged' });
            }}
          />
        ) : null}
        {open === 'note' ? (
          <NoteSheet
            visible
            onClose={() => setOpen(null)}
            initial={t.dayLog?.note ?? ''}
            onSave={(note) => {
              setOpen(null);
              void apply(planNote(t.today, t.dayLog ?? null, note, t.plan.template?.id ?? null));
              showSnackbar({ message: 'Note saved' });
            }}
          />
        ) : null}
      </Screen>
      <View style={[styles.fab, { bottom: TAB_BAR_HEIGHT + insets.bottom + 12 }]}>
        <Fab
          label="+200"
          accessibilityLabel="Add 200 ml of water. Hold for more amounts"
          onPress={() => logWater(200)}
          onLongPress={() => setOpen('water')}
          testID="water-fab"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  fab: { position: 'absolute', right: 16 },
});
