import { useRouter } from 'expo-router';
import { CalendarDays, ChevronDown, Footprints } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { WeighInSheet } from '@/features/body/components/WeighInSheet';
import { useBody } from '@/features/body/hooks/useBody';
import { planWeighIn } from '@/features/body/lib/weight';
import { SwitchTemplateSheet } from '@/features/routine/components/SwitchTemplateSheet';
import { dayMinutes, hhmm } from '@/features/routine/lib/blocks';
import type { Change } from '@/features/routine/lib/changes';
import { applyChanges } from '@/features/routine/slice';
import { istClock, isoWeekday } from '@/lib/dates';
import { markTodayReady } from '@/lib/startup';
import { formatClock, formatIndianNumber } from '@/lib/format';
import { drinkAmount } from '../lib/auto';
import { useFood } from '@/features/food/hooks/useFood';
import { useFoodActions } from '@/features/food/hooks/useFoodActions';
import { useReminderSchedule } from '@/features/notifications/hooks/useReminderSchedule';
import { useReminderSync } from '@/features/notifications/hooks/useReminderSync';
import {
  AuditCard,
  FallbackCard,
  InterruptCard,
  PinnedCard,
  RealityCard,
  RecoveryCard,
} from '@/features/accountability/components/NudgeCards';
import { useAccountability } from '@/features/accountability/hooks/useAccountability';
import { EGGS, type NudgeKind, planNudge, SNOOZE_MIN } from '@/features/accountability/lib/rules';
import { interruptSnoozed } from '@/features/accountability/slice';
import { ChangeCard } from '@/features/review/components/ChangeCard';
import { useReviews } from '@/features/review/hooks/useReview';
import { pinnedChange, type Summary } from '@/features/review/lib/review';
import { useSteps } from '@/features/steps/hooks/useSteps';
import { MorningCheckCard } from '@/features/sleep/components/MorningCheckCard';
import { useLogNight } from '@/features/sleep/hooks/useLogNight';
import { useSleep } from '@/features/sleep/hooks/useSleep';
import { planPhoneOff } from '@/features/sleep/lib/sleep';
import {
  TOP3_FROM_MIN,
  TOP3_UNTIL_MIN,
  TodayTop3Card,
} from '@/features/tasks/components/TodayTop3Card';
import { useTasks } from '@/features/tasks/hooks/useTasks';
import { useTaskActions } from '@/features/tasks/hooks/useTaskActions';
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
import { type BlockStatus, planBlockStatus, planNote, statusOf } from '../lib/changes';
import { mealSummary } from '../lib/meals';
import { canMoveToTomorrow, moveSummary, planMoveToTomorrow } from '../lib/program';
import { streakLine } from '../lib/streak';
import { dayKicker, type RowContext, rowTitle, shortDay } from '../lib/present';
import { formatMinutes, nowDayMinutes, endOf } from '../lib/timeline';
import { type DayRow, openRows, type SkipReason } from '../selectors';
import { EndOfDayCard, type EndOfDayItem } from './EndOfDayCard';
import { NoteSheet, SleepSheet } from './LogSheets';
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
  const body = useBody(now);
  const food = useFood(now);
  const foodActions = useFoodActions(food);
  // F15: keep the phone's reminders in step with today's and tomorrow's plan.
  const reviews = useReviews();
  // F24: accountability nudges (cards + the interrupt notification time).
  const acc = useAccountability(t, body, nowDayMinutes(now));
  const reviewedWeeks = useMemo(() => new Set(reviews.map((r) => r.week_start)), [reviews]);
  useReminderSync(
    useReminderSchedule({ t, food, water, reviewedWeeks, interruptAt: acc.interruptAt }),
  );
  const { log: logWaterEntry } = useLogWater();
  useDayScoreSync(t);
  const sleep = useSleep(now);
  const tasks = useTasks(now);
  const steps = useSteps(now);
  // F21: refresh steps (Apple Health or the iPhone motion chip) once per visit.
  // F23: stop the cold-start clock once the day's plan is on screen.
  const planReady = !t.isLoading;
  useEffect(() => {
    if (planReady) markTodayReady(clock());
  }, [planReady]);
  const stepsSynced = useRef(false);
  const { auto: stepsAuto, syncAuto } = steps;
  useEffect(() => {
    if (!stepsAuto || stepsSynced.current) return;
    stepsSynced.current = true;
    void syncAuto(clock()).catch(() => undefined);
  }, [stepsAuto, syncAuto]);
  const pinned = pinnedChange(reviews, t.today);
  const taskActions = useTaskActions(tasks.all, tasks.today);
  const logNight = useLogNight(t, sleep);
  const { streak } = useStreak(t.today, t.plan.blocks.length > 0 ? t.day.score.score : null);
  const dispatch = useAppDispatch();
  // Record each new interrupt once (max 3 a day counts these rows).
  const interruptLogged = useRef<string | null>(null);
  const newInterrupt = acc.interrupt.isNew ? `${t.today}:${acc.interrupt.shownToday}` : null;
  useEffect(() => {
    if (!newInterrupt || interruptLogged.current === newInterrupt) return;
    interruptLogged.current = newInterrupt;
    void dispatch(applyChanges(planNudge(t.today, 'interrupt', clock())));
  }, [newInterrupt, t.today, dispatch]);
  const router = useRouter();
  const showSnackbar = useSnackbar();
  const { colors } = useTheme();
  const [open, setOpen] = useState<Open>(null);
  const [skipping, setSkipping] = useState<DayRow | null>(null);
  const insets = useSafeAreaInsets();

  // Undo runs later, against the rows as they are then.
  const latest = useRef(t);
  const latestSleep = useRef(sleep);
  useEffect(() => {
    latest.current = t;
    latestSleep.current = sleep;
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
    // F14: the Phone away tick is tonight's phone_off_kept.
    const phone = (s: BlockStatus, tonight = sleep.tonight) =>
      row.block.kind === 'phone_off' ? planPhoneOff(date, tonight, s?.status === 'done') : [];
    haptics.tap();
    await apply([
      ...planBlockStatus(blockId, date, logFor(blockId), next, clock()),
      ...phone(next),
    ]);
    showSnackbar({
      message,
      actionLabel: 'Undo',
      onAction: () =>
        void apply([
          ...planBlockStatus(blockId, date, logFor(blockId, latest.current), before, clock()),
          ...phone(before, latestSleep.current.tonight),
        ]),
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

  // ---- F24 nudges --------------------------------------------------------
  const nudge = (kind: NudgeKind, opts?: Parameters<typeof planNudge>[3]) =>
    apply(planNudge(t.today, kind, clock(), opts));
  const openInterrupt = t.nudges.find(
    (n) => n.date === t.today && n.kind === 'interrupt' && !n.dismissed_at && !n.deleted_at,
  );
  const endInterrupt = () =>
    openInterrupt &&
    void apply([
      {
        op: 'upsert',
        table: 'nudge_log',
        clientId: openInterrupt.client_id,
        row: { dismissed_at: new Date(clock()).toISOString() },
      },
    ]);
  const rowById = (clientId: string) => t.day.rows.find((r) => r.block.client_id === clientId);
  const doBlock = (clientId: string) => {
    const r = rowById(clientId);
    if (!r) return;
    if (r.block.kind === 'water') logWater(drinkAmount(r.block.title));
    else void setStatus(r, { status: 'done' }, `${rowTitle(r, ctx.session)} done`);
  };
  const rescue = (kind: 'rescue_eggs' | 'rescue_walk' | 'rescue_water' | 'rescue_plank') => {
    if (kind === 'rescue_eggs')
      foodActions.addOffPlan(
        {
          text: '2 boiled eggs',
          kcal: EGGS.kcal,
          protein: EGGS.protein,
          mealId: null,
          replaces: false,
        },
        null,
      );
    if (kind === 'rescue_water') logWater(500);
    if (kind === 'rescue_walk') void steps.setToday((steps.count ?? 0) + 1000);
    void nudge(kind);
    haptics.success();
  };

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
  const templateOnly = (
    <Chip
      label={t.plan.template?.name ?? 'No template'}
      trailingIcon={ChevronDown}
      accessibilityLabel={`Template ${t.plan.template?.name ?? 'none'}. Switch template for today`}
      onPress={() => setOpen('switch')}
    />
  );
  // Steps chip (F21): hidden until there are steps or Health is connected.
  const templateChip =
    steps.count !== null || steps.auto !== null ? (
      <View style={styles.chips}>
        <Chip
          label={formatIndianNumber(steps.count ?? 0)}
          leadingIcon={Footprints}
          accessibilityLabel={`${formatIndianNumber(steps.count ?? 0)} steps today of ${formatIndianNumber(steps.targets.min)}. Open Steps`}
          onPress={() => router.push('/steps')}
          testID="steps-chip"
        />
        {templateOnly}
      </View>
    ) : (
      templateOnly
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
  const sleepLogged = Boolean(t.sleep && !t.sleep.deleted_at && t.sleep.wake_at);
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

        {acc.interrupt.show && acc.interrupt.target ? (
          <InterruptCard
            overdue={acc.interrupt.overdue}
            target={acc.interrupt.target}
            nowText={formatClock(istClock(now)).toUpperCase()}
            detail={
              acc.interrupt.target.block.kind === 'water'
                ? `Water ${formatIndianNumber(water.totalMl)} / ${formatIndianNumber(water.targetMl)} ml.`
                : `It takes ${acc.interrupt.target.block.duration_min} min.`
            }
            onDone={() => {
              doBlock(acc.interrupt.target!.block.client_id);
              endInterrupt();
            }}
            onSnooze={() => {
              dispatch(interruptSnoozed(clock() + SNOOZE_MIN * 60_000));
              endInterrupt();
            }}
          />
        ) : null}

        {acc.recovery.show && acc.recovery.yesterdayScore !== null ? (
          <RecoveryCard
            yesterdayScore={acc.recovery.yesterdayScore}
            missed={acc.recovery.missedTitles}
            options={acc.recovery.options}
            graceLine={
              acc.streak.graceAvailable ? 'streak: 1 grace left' : 'streak: grace day used'
            }
            onLock={(o) => {
              void nudge('pinned', { ref: o.clientId });
              void nudge('missed_day', { dismissed: true });
              showSnackbar({ message: `Locked in: ${o.title}` });
            }}
            onDismiss={() => void nudge('missed_day', { dismissed: true })}
          />
        ) : acc.pinned ? (
          <PinnedCard row={acc.pinned} onDone={() => doBlock(acc.pinned!.block.client_id)} />
        ) : null}

        {acc.fallback.show ? (
          <FallbackCard
            f={acc.fallback}
            nowText={formatClock(istClock(now))}
            waterLine={`water ${formatIndianNumber(water.totalMl)} → ${formatIndianNumber(water.totalMl + 500)}`}
            onRescue={rescue}
          />
        ) : null}

        {acc.reality?.show ? (
          <RealityCard
            r={acc.reality}
            onStrict={() => {
              void nudge('strict_week');
              void nudge('reality_weight', { dismissed: true });
              showSnackbar({ message: 'Strict week: meals show “weigh it” for 7 days' });
            }}
            onWater={() => void nudge('reality_weight', { dismissed: true })}
          />
        ) : acc.audit ? (
          <AuditCard onDone={() => void nudge('reality_audit', { dismissed: true })} />
        ) : null}

        {pinned ? (
          <ChangeCard
            text={pinned.text}
            summary={pinned.review.summary as Partial<Summary> | null}
            onPress={() => router.push('/reviews')}
          />
        ) : null}

        {sleep.check && !sleep.isLoading ? (
          <MorningCheckCard
            now={now}
            date={sleep.today}
            bed={sleep.check.bed}
            wake={sleep.check.wake}
            targetBed={sleep.target.bed}
            onCorrect={() => sleep.check && logNight(sleep.check.bed, sleep.check.wake)}
            onAdjust={() => setOpen('sleep')}
          />
        ) : null}

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

        {ctx.nowMin >= TOP3_FROM_MIN &&
        ctx.nowMin < TOP3_UNTIL_MIN &&
        (tasks.top3.length > 0 || tasks.pending.length > 0) ? (
          <TodayTop3Card
            top3={tasks.top3}
            openCount={tasks.all.filter((x) => x.status === 'open').length}
            today={tasks.today}
            onToggle={taskActions.toggleDone}
            onOpenTasks={() => router.push('/tasks')}
          />
        ) : null}

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
          <WeighInSheet
            today={body.today}
            points={body.points}
            initialKg={
              body.todayRow && !body.todayRow.deleted_at
                ? Number(body.todayRow.weight_kg)
                : (body.points.at(-1)?.weight ?? Number(t.profile?.start_weight_kg ?? 80))
            }
            initialSalty={body.todayRow?.note === 'salty'}
            onClose={() => setOpen(null)}
            onSave={(kg, salty) => {
              setOpen(null);
              void apply([{ op: 'upsert', ...planWeighIn(body.today, kg, salty, body.todayRow) }]);
              showSnackbar({ message: `${kg.toFixed(1)} kg logged` });
            }}
          />
        ) : null}
        {open === 'sleep' ? (
          <SleepSheet
            visible
            onClose={() => setOpen(null)}
            initialBed={
              sleep.lastNight?.bed_at ? istClock(sleep.lastNight.bed_at) : sleep.target.bed
            }
            initialWake={
              sleep.lastNight?.wake_at
                ? istClock(sleep.lastNight.wake_at)
                : (sleep.check?.wake ?? sleep.target.wake)
            }
            onSave={(bed, wake) => {
              setOpen(null);
              logNight(bed, wake);
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
  chips: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  fill: { flex: 1 },
  fab: { position: 'absolute', right: 16 },
});
