import { useRouter } from 'expo-router';
import { Check, ChevronRight, Play, Square, X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useNow } from '@/features/today/hooks/useNow';
import { useToday } from '@/features/today/hooks/useToday';
import { shortDay } from '@/features/today/lib/present';
import { type DateString, istClock } from '@/lib/dates';
import type { ReactNode } from 'react';
import { formatClock } from '@/lib/format';
import { useAppDispatch, useAppSelector } from '@/store';
import {
  Button,
  Card,
  EmptyState,
  haptics,
  NumberStepper,
  Ring,
  StatusChip,
  Text,
  useTheme,
} from '@/ui';

import { useTrain } from '../hooks/useTrain';
import { useTrainActions } from '../hooks/useTrainActions';
import {
  type ExerciseRow,
  isBodyweight,
  isTimed,
  MAX_WEIGHT_KG,
  targetText,
  weightStep,
  type WorkoutItem,
} from '../lib/program';
import {
  circuitPosition,
  currentIndex,
  lastTime,
  prefill,
  type SessionRow,
  type SetLogRow,
  setsOf,
} from '../lib/session';
import { focused, restEnded } from '../slice';
import { ExerciseTabs, mmss, RestView, SummaryView } from './SessionParts';

type Ctx = {
  date: DateString;
  session: SessionRow;
  items: WorkoutItem[];
  logs: SetLogRow[];
  exercises: ReadonlyMap<string, ExerciseRow>;
};

const label = (ex: ExerciseRow | undefined) => ex?.name ?? 'Exercise';

/** `/session/[date]`: one exercise at a time, rest timer, timed holds, circuit rounds, summary. */
export function SessionScreen({ date, now: fixedNow }: { date: DateString; now?: number }) {
  const ticking = useNow(1000);
  const now = fixedNow ?? ticking;
  const router = useRouter();
  const dispatch = useAppDispatch();
  const insets = useSafeAreaInsets();
  const t = useToday(now);
  const train = useTrain(t);
  const actions = useTrainActions();
  const rest = useAppSelector((s) => (s.train.rest?.date === date ? s.train.rest : null));
  const focus = useAppSelector((s) =>
    s.train.focus?.date === date ? s.train.focus.exerciseId : null,
  );
  const { day, items } = train.dayOf(date);
  const found = train.sessionOn(date);
  const session = found && !found.deleted_at && found.started_at ? found : null;
  const starting = useRef(false);

  // Opening the screen starts (or resumes) the session.
  useEffect(() => {
    if (
      !day ||
      session ||
      starting.current ||
      items.length === 0 ||
      day.kind === 'rest' ||
      day.kind === 'walk'
    )
      return;
    starting.current = true;
    void actions.start(date, day.id, found).finally(() => {
      starting.current = false;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day?.id, Boolean(session), items.length]);

  // Rest over while the screen is open: buzz and clear (the notification covers background).
  const restLeft = rest ? (rest.endsAt - now) / 1000 : 0;
  useEffect(() => {
    if (rest && restLeft <= 0) {
      haptics.success();
      dispatch(restEnded());
    }
  }, [rest, restLeft, dispatch]);

  const close = () => router.back();
  if (!day || items.length === 0 || day.kind === 'rest' || day.kind === 'walk') {
    return (
      <Frame title="Session" sub={shortDay(date)} onClose={close} insetTop={insets.top}>
        <EmptyState
          icon={X}
          title="No session to log"
          body="Rest and walk days are logged from the Train tab."
        />
      </Frame>
    );
  }
  if (!session) {
    return (
      <Frame title={day.title} sub="Starting…" onClose={close} insetTop={insets.top}>
        <Text variant="sub" tone="secondary">
          Starting your session…
        </Text>
      </Frame>
    );
  }

  const ctx: Ctx = { date, session, items, logs: train.logs, exercises: train.exercises };
  const elapsed = session.started_at
    ? Math.max(
        0,
        (Date.parse(session.finished_at ?? new Date(now).toISOString()) -
          Date.parse(session.started_at)) /
          1000,
      )
    : 0;
  const sub = session.finished_at ? shortDay(date) : `${mmss(elapsed)} elapsed`;

  if (session.finished_at) {
    return (
      <Frame title={day.title} sub={sub} onClose={close} insetTop={insets.top}>
        <SummaryView
          title={day.title}
          session={session}
          items={items}
          exercises={train.exercises}
          logs={train.logs}
          onDone={close}
        />
      </Frame>
    );
  }

  const auto = currentIndex(items, train.logs, session.id);
  const focusIdx = focus ? items.findIndex((i) => i.exercise_id === focus) : -1;
  const idx = focusIdx >= 0 ? focusIdx : Math.max(auto, 0);
  const allDone = auto === -1;
  const finish = () => void actions.finish(session, items, train.logs);
  const finishButton = (
    <Pressable
      onPress={finish}
      accessibilityRole="button"
      accessibilityLabel="Finish session"
      hitSlop={8}
    >
      <Text variant="sub" weight={700} tone="primary">
        Finish
      </Text>
    </Pressable>
  );

  const nextText = (() => {
    if (day.kind === 'circuit') return 'Next station';
    const item = items[idx];
    if (!item) return 'Finish';
    const done = setsOf(train.logs, session.id, item.exercise_id).length;
    if (done < item.sets)
      return `${label(train.exercises.get(item.exercise_id))} · Set ${done + 1} of ${item.sets}`;
    const nxt = items[idx + 1];
    return nxt ? label(train.exercises.get(nxt.exercise_id)) : 'Finish';
  })();

  return (
    <Frame
      title={day.title}
      sub={sub}
      onClose={close}
      accessory={finishButton}
      insetTop={insets.top}
    >
      {day.kind !== 'circuit' ? (
        <ExerciseTabs
          items={items}
          exercises={train.exercises}
          logs={train.logs}
          sessionId={session.id}
          current={idx}
          onPick={(n) => dispatch(focused({ date, exerciseId: items[n]!.exercise_id }))}
        />
      ) : null}
      {rest && restLeft > 0 ? (
        <RestView
          left={restLeft}
          total={rest.totalSec}
          next={nextText}
          onAdd={() => actions.addRest(15, nextText)}
          onSkip={actions.skipRest}
        />
      ) : day.kind === 'circuit' ? (
        <CircuitPanel ctx={ctx} roundsLabel={day.title} />
      ) : (
        <ExercisePanel key={`${items[idx]!.exercise_id}`} ctx={ctx} index={idx} now={now} />
      )}
      {allDone && !(rest && restLeft > 0) ? (
        <Button
          icon={Check}
          label="Finish session"
          accessibilityLabel="Finish session now"
          onPress={finish}
          fullWidth
          size="lg"
        />
      ) : null}
      {!allDone && day.kind !== 'circuit' ? (
        <Text variant="caption" tone="secondary">
          Leave any time — the session stays open and resumes where you left off.
        </Text>
      ) : null}
    </Frame>
  );
}

function Frame(props: {
  title: string;
  sub: string;
  onClose: () => void;
  accessory?: ReactNode;
  insetTop: number;
  children: ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <ScrollView
      style={{ backgroundColor: colors.canvas }}
      contentContainerStyle={[styles.content, { paddingTop: props.insetTop + 12 }]}
    >
      <View style={styles.header}>
        <Pressable
          onPress={props.onClose}
          accessibilityRole="button"
          accessibilityLabel="Close session"
          hitSlop={10}
          style={styles.headerSide}
        >
          <X size={22} color={colors.text} strokeWidth={2} />
        </Pressable>
        <View style={styles.headerMid}>
          <Text variant="body" weight={700} accessibilityRole="header">
            {props.title}
          </Text>
          <Text variant="caption" tone="secondary" num>
            {props.sub}
          </Text>
        </View>
        <View style={[styles.headerSide, styles.right]}>{props.accessory}</View>
      </View>
      {props.children}
    </ScrollView>
  );
}

/** One strength exercise (Train-Logger) or a timed one (Train-Timed). */
function ExercisePanel({ ctx, index, now }: { ctx: Ctx; index: number; now: number }) {
  const { colors } = useTheme();
  const dispatch = useAppDispatch();
  const actions = useTrainActions();
  const hold = useAppSelector((s) => s.train.hold);
  const item = ctx.items[index]!;
  const ex = ctx.exercises.get(item.exercise_id);
  const done = setsOf(ctx.logs, ctx.session.id, item.exercise_id);
  const last = lastTime(ctx.logs, item.exercise_id, ctx.date);
  const setNo = Math.min(done.length + 1, item.sets);
  const complete = done.length >= item.sets;
  const fill = prefill(item, done, last?.sets ?? null);
  const [weight, setWeight] = useState(fill.weight);
  const [reps, setReps] = useState(fill.reps);
  const timed = isTimed(item);
  const bodyweight = isBodyweight(ex);
  const next = ctx.items[index + 1];
  const perHand = ex?.unilateral ? 'kg per hand · per side' : 'kg per hand';

  const log = (set: { weight: number | null; reps: number | null; duration: number | null }) => {
    const isLastSet = done.length + 1 >= item.sets;
    const isLastOfAll = isLastSet && !next;
    void actions.logSet(
      { session: ctx.session, items: ctx.items, logs: ctx.logs, date: ctx.date },
      { exerciseId: item.exercise_id, setNo: done.length + 1, ...set },
      isLastOfAll ? 0 : item.rest_sec,
      isLastSet
        ? next
          ? label(ctx.exercises.get(next.exercise_id))
          : 'Finish'
        : `${label(ex)} · Set ${done.length + 2} of ${item.sets}`,
    );
    if (isLastSet)
      dispatch(focused(next ? { date: ctx.date, exerciseId: next.exercise_id } : null));
  };

  const holding =
    hold && hold.date === ctx.date && hold.exerciseId === item.exercise_id ? hold : null;
  const heldSec = holding ? Math.max(0, Math.round((now - holding.startedAt) / 1000)) : 0;
  const targetSec = item.rep_max ?? item.duration_sec ?? 30;

  return (
    <View style={styles.gap} testID="exercise-panel">
      <View style={styles.kickerRow}>
        <Text
          variant="kicker"
          tone="secondary"
        >{`Exercise ${index + 1} of ${ctx.items.length}`}</Text>
        {ex?.muscle ? <StatusChip label={ex.muscle} tone="protein" /> : null}
      </View>
      <Text variant="title">{label(ex)}</Text>
      <Text variant="sub" tone="secondary">
        {complete
          ? `All ${item.sets} sets done`
          : `Set ${setNo} of ${item.sets} · ${targetText(item, ex).replace(/^\d+ × /, '')}${item.rest_sec ? ` · rest ${item.rest_sec} s` : ''}`}
      </Text>
      {ex?.cue ? (
        <Text variant="caption" tone="secondary">
          {ex.cue}
        </Text>
      ) : null}
      {last ? (
        <View
          style={[styles.last, { backgroundColor: colors.recessed }]}
          accessible
          accessibilityLabel={`Last time ${shortDay(last.date)}`}
        >
          <Text variant="caption" tone="secondary">{`Last time (${shortDay(last.date)})`}</Text>
          <Text variant="caption" weight={700} num>
            {last.sets
              .map((s) =>
                s.duration_sec !== null && s.reps === null
                  ? `${s.duration_sec} s`
                  : `${Number(s.weight_kg ?? 0) > 0 ? `${Number(s.weight_kg)} kg × ` : ''}${s.reps ?? 0}`,
              )
              .join(' · ')}
          </Text>
        </View>
      ) : null}

      {complete ? null : timed ? (
        <View style={styles.center}>
          <Ring
            size={220}
            strokeWidth={14}
            accent="protein"
            progress={targetSec > 0 ? Math.min(heldSec / targetSec, 1) : 0}
            accessibilityLabel={`Hold ${heldSec} seconds`}
          >
            <View style={styles.center}>
              <Text variant="kicker" tone="secondary">
                {holding ? 'Hold' : 'Ready'}
              </Text>
              <Text variant="hero" num>
                {mmss(holding ? Math.max(targetSec - heldSec, 0) : targetSec)}
              </Text>
              <Text variant="sub" tone="secondary">
                {holding
                  ? `left of ${targetSec} s · ${heldSec} s done`
                  : `target ${targetText(item).replace(/^\d+ × /, '')}`}
              </Text>
            </View>
          </Ring>
          {holding ? (
            <Button
              icon={Square}
              label={`Stop & log ${heldSec} s`}
              accessibilityLabel={`Stop and log ${heldSec} seconds`}
              onPress={() => {
                actions.endHold();
                log({ weight: null, reps: null, duration: heldSec });
              }}
              fullWidth
              size="lg"
            />
          ) : (
            <Button
              icon={Play}
              label={`Start set ${setNo}`}
              accessibilityLabel={`Start holding set ${setNo}`}
              onPress={() => actions.startHold(ctx.date, item.exercise_id, setNo)}
              fullWidth
              size="lg"
            />
          )}
        </View>
      ) : (
        <>
          {bodyweight ? null : (
            <View style={styles.gapSm}>
              <View style={styles.between}>
                <Text variant="sub" weight={600}>
                  Weight
                </Text>
                <Text
                  variant="caption"
                  tone="secondary"
                >{`max ${MAX_WEIGHT_KG} kg · 0.5 / 1 kg steps`}</Text>
              </View>
              <NumberStepper
                value={weight}
                onChange={setWeight}
                accessibilityLabel="Weight"
                step={weightStep}
                min={0}
                max={MAX_WEIGHT_KG}
                decimals={1}
                unit={perHand}
              />
            </View>
          )}
          <View style={styles.gapSm}>
            <View style={styles.between}>
              <Text variant="sub" weight={600}>
                Reps
              </Text>
              <Text
                variant="caption"
                tone="secondary"
              >{`target ${targetText(item).replace(/^\d+ × /, '')}`}</Text>
            </View>
            <NumberStepper
              value={reps}
              onChange={setReps}
              accessibilityLabel="Reps"
              min={0}
              max={50}
              unit="reps"
            />
          </View>
          <Button
            icon={Check}
            label={`Log set ${setNo} · ${bodyweight ? '' : `${weight} kg × `}${reps}`}
            accessibilityLabel={`Log set ${setNo}`}
            onPress={() => log({ weight: bodyweight ? null : weight, reps, duration: null })}
            fullWidth
            size="lg"
          />
        </>
      )}

      <Card kicker="Sets" padding={14} gap={6} testID="sets-card">
        {Array.from({ length: Math.max(item.sets, done.length) }, (_, n) => {
          const s = done[n];
          const lastSet = last?.sets.find((l) => l.set_no === n + 1);
          const isNow = !s && n === done.length;
          return (
            <View
              key={n}
              style={[
                styles.setRow,
                isNow ? { backgroundColor: colors.accents.primary.tint } : null,
              ]}
            >
              <View
                style={[
                  styles.setDot,
                  {
                    backgroundColor: s
                      ? colors.accents.success.base
                      : isNow
                        ? colors.buttonPrimary
                        : 'transparent',
                    borderColor: s ? colors.accents.success.base : colors.border,
                  },
                ]}
              >
                {s ? (
                  <Check size={12} color={colors.onButton} strokeWidth={3} />
                ) : (
                  <Text variant="caption" weight={700} tone={isNow ? 'onButton' : 'secondary'}>
                    {String(n + 1)}
                  </Text>
                )}
              </View>
              <Text variant="sub" tone="secondary" style={styles.setLabel}>{`Set ${n + 1}`}</Text>
              <Text
                variant="body"
                weight={s ? 700 : 400}
                tone={s ? 'default' : isNow ? 'primary' : 'secondary'}
                style={styles.flex}
                num
              >
                {s
                  ? s.duration_sec !== null && s.reps === null
                    ? `${s.duration_sec} s`
                    : `${Number(s.weight_kg ?? 0) > 0 ? `${Number(s.weight_kg)} kg × ` : ''}${s.reps ?? 0}`
                  : isNow
                    ? 'Now'
                    : lastSet
                      ? lastSet.duration_sec !== null && lastSet.reps === null
                        ? `${lastSet.duration_sec} s`
                        : `${Number(lastSet.weight_kg ?? 0) > 0 ? `${Number(lastSet.weight_kg)} × ` : ''}${lastSet.reps ?? 0}`
                      : '—'}
              </Text>
              <Text variant="caption" tone="secondary">
                {s?.created_at ? formatClock(istClock(s.created_at)) : !s && lastSet ? 'last' : ''}
              </Text>
            </View>
          );
        })}
      </Card>

      {next ? (
        <Pressable
          onPress={() => dispatch(focused({ date: ctx.date, exerciseId: next.exercise_id }))}
          accessibilityRole="button"
          accessibilityLabel={`Next exercise: ${label(ctx.exercises.get(next.exercise_id))}`}
          style={styles.nextRow}
        >
          <ChevronRight size={16} color={colors.textSecondary} strokeWidth={2} />
          <Text
            variant="sub"
            tone="secondary"
          >{`Next: ${label(ctx.exercises.get(next.exercise_id))} · ${targetText(next, ctx.exercises.get(next.exercise_id))}`}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Circuit day (Train-Circuit): round N of R, stations in order, "Station done". */
function CircuitPanel({ ctx, roundsLabel }: { ctx: Ctx; roundsLabel: string }) {
  const { colors } = useTheme();
  const actions = useTrainActions();
  const pos = circuitPosition(ctx.items, ctx.logs, ctx.session.id);
  const station = ctx.items[pos.station];
  const ex = station ? ctx.exercises.get(station.exercise_id) : undefined;
  const done = station ? setsOf(ctx.logs, ctx.session.id, station.exercise_id) : [];
  const last = station ? lastTime(ctx.logs, station.exercise_id, ctx.date) : null;
  const fill = station ? prefill(station, done, last?.sets ?? null) : null;
  const [weights, setWeights] = useState<Record<string, number>>({});
  const weight = station ? (weights[station.exercise_id] ?? fill?.weight ?? 0) : 0;

  if (pos.done || !station) {
    return (
      <Card testID="circuit-done">
        <Text variant="heading">{`All ${pos.rounds} rounds done`}</Text>
        <Text variant="sub" tone="secondary">
          {`${roundsLabel} complete. Finish to save it.`}
        </Text>
      </Card>
    );
  }

  const isLastStation = pos.station === ctx.items.length - 1;
  const nextStation = isLastStation ? ctx.items[0] : ctx.items[pos.station + 1];
  return (
    <View style={styles.gap} testID="circuit-panel">
      <Text variant="title" accessibilityRole="header">
        {`Round ${pos.round} `}
        <Text variant="heading" tone="secondary">{`of ${pos.rounds}`}</Text>
      </Text>
      <Text
        variant="sub"
        tone="secondary"
      >{`No rest between stations · ${ctx.items.at(-1)?.rest_sec ?? 0} s between rounds`}</Text>
      <View style={styles.bars}>
        {Array.from({ length: pos.rounds }, (_, r) => (
          <View
            key={r}
            style={[
              styles.bar,
              {
                backgroundColor:
                  r + 1 < pos.round
                    ? colors.accents.success.base
                    : r + 1 === pos.round
                      ? colors.accents.primary.base
                      : colors.recessed,
              },
            ]}
          />
        ))}
      </View>
      <Card kicker="Stations" padding={14} gap={6}>
        {ctx.items.map((i, n) => {
          const e = ctx.exercises.get(i.exercise_id);
          const isDone = setsOf(ctx.logs, ctx.session.id, i.exercise_id).length >= pos.round;
          const isNow = n === pos.station;
          return (
            <View
              key={i.id}
              style={[
                styles.setRow,
                isNow
                  ? {
                      borderColor: colors.accents.primary.base,
                      borderWidth: 1.5,
                      backgroundColor: colors.accents.primary.tint,
                    }
                  : null,
              ]}
            >
              <View
                style={[
                  styles.setDot,
                  {
                    backgroundColor: isDone
                      ? colors.accents.success.base
                      : isNow
                        ? colors.buttonPrimary
                        : 'transparent',
                    borderColor: isDone ? colors.accents.success.base : colors.border,
                  },
                ]}
              >
                {isDone ? <Check size={12} color={colors.onButton} strokeWidth={3} /> : null}
              </View>
              <View style={styles.flex}>
                <Text variant="body" weight={700} tone={isDone ? 'secondary' : 'default'}>
                  {label(e)}
                </Text>
                <Text variant="caption" tone="secondary">
                  {isBodyweight(e)
                    ? 'bodyweight'
                    : `${weights[i.exercise_id] ?? prefill(i, setsOf(ctx.logs, ctx.session.id, i.exercise_id), lastTime(ctx.logs, i.exercise_id, ctx.date)?.sets ?? null).weight} kg / hand`}
                </Text>
              </View>
              <Text variant="sub" weight={700}>
                {`${i.rep_min ?? i.rep_max ?? 'max'}${e?.unilateral ? ' / side' : ' reps'}`}
              </Text>
            </View>
          );
        })}
      </Card>
      {isBodyweight(ex) ? null : (
        <NumberStepper
          value={weight}
          onChange={(w) => setWeights((m) => ({ ...m, [station.exercise_id]: w }))}
          accessibilityLabel={`${label(ex)} weight`}
          step={weightStep}
          min={0}
          max={MAX_WEIGHT_KG}
          decimals={1}
          unit="kg per hand"
        />
      )}
      <Button
        icon={Check}
        label={`Station done · ${label(ex)}`}
        accessibilityLabel={`Station done, ${label(ex)}`}
        onPress={() =>
          void actions.logSet(
            { session: ctx.session, items: ctx.items, logs: ctx.logs, date: ctx.date },
            {
              exerciseId: station.exercise_id,
              setNo: pos.round,
              weight: isBodyweight(ex) ? null : weight,
              reps: station.rep_min ?? station.rep_max ?? 10,
              duration: null,
            },
            isLastStation && pos.round < pos.rounds ? station.rest_sec : 0,
            `Round ${pos.round + 1} · ${label(ctx.exercises.get(nextStation?.exercise_id ?? ''))}`,
          )
        }
        fullWidth
        size="lg"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 48, gap: 16 },
  header: { flexDirection: 'row', alignItems: 'center' },
  headerSide: { width: 64, minHeight: 44, justifyContent: 'center' },
  right: { alignItems: 'flex-end' },
  headerMid: { flex: 1, alignItems: 'center' },
  gap: { gap: 14 },
  gapSm: { gap: 8 },
  kickerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  last: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
    gap: 8,
  },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  center: { alignItems: 'center', gap: 14 },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 8,
    borderRadius: 12,
    minHeight: 44,
  },
  setDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setLabel: { width: 48 },
  flex: { flex: 1, minWidth: 0 },
  nextRow: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44 },
  bars: { flexDirection: 'row', gap: 6 },
  bar: { flex: 1, height: 6, borderRadius: 3 },
});
