import { useRouter } from 'expo-router';
import { CalendarDays, Check, Clock, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { hhmm } from '@/features/routine/lib/blocks';
import { applyChanges } from '@/features/routine/slice';
import { useNow } from '@/features/today/hooks/useNow';
import { useToday } from '@/features/today/hooks/useToday';
import { dayMonth, shortDay } from '@/features/today/lib/present';
import { addDays, isoWeekday } from '@/lib/dates';
import { formatClock, formatInr } from '@/lib/format';
import { useAppDispatch } from '@/store';
import {
  Button,
  Card,
  Chip,
  Ring,
  Screen,
  StatTile,
  StatusChip,
  Text,
  useSnackbar,
  useTheme,
} from '@/ui';

import { useReview } from '../hooks/useReview';
import { changeIdeas, gradeFor, planReview, REVIEW_TIME, TEXT_MAX, weekLabel } from '../lib/review';

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const signed = (v: number, unit: string) =>
  `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v)}${unit}`;

function Steps({ step }: { step: number }) {
  const { colors } = useTheme();
  return (
    <View style={styles.dots} accessible accessibilityLabel={`Step ${step} of 3`}>
      {[1, 2, 3].map((i) => (
        <View
          key={i}
          style={[
            styles.dot,
            {
              width: i === step ? 24 : 8,
              backgroundColor: i <= step ? colors.accents.primary.base : colors.hairline,
            },
          ]}
        />
      ))}
    </View>
  );
}

function Field({
  label,
  value,
  onChange,
  focused,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  focused?: boolean;
}) {
  const { colors } = useTheme();
  const [focus, setFocus] = useState(false);
  return (
    <View style={styles.gap6}>
      <Text variant="body" weight={700}>
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        multiline
        maxLength={TEXT_MAX}
        accessibilityLabel={label}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        autoFocus={focused}
        style={[
          styles.input,
          {
            color: colors.text,
            backgroundColor: colors.raised,
            borderColor: focus ? colors.accents.primary.base : colors.hairline,
          },
        ]}
      />
      <Text
        variant="caption"
        tone="secondary"
        align="right"
      >{`${value.length} / ${TEXT_MAX}`}</Text>
    </View>
  );
}

/** `/review` (Review-1/2/3 designs, PRD F20): numbers → reflect → saved, under 2 minutes. */
export function ReviewScreen({ now: fixedNow }: { now?: number } = {}) {
  const ticking = useNow(60_000);
  const now = fixedNow ?? ticking;
  const router = useRouter();
  const dispatch = useAppDispatch();
  const showSnackbar = useSnackbar();
  const { colors } = useTheme();
  const t = useToday(now);
  const r = useReview(t);
  const [step, setStep] = useState(1);
  const [wentWell, setWentWell] = useState(r.existing?.went_well ?? '');
  const [change, setChange] = useState(r.existing?.change_next_week ?? '');
  const s = r.summary;
  const grade = gradeFor(s.avgScore);
  const sunday = addDays(r.week, 6);
  const nextMonday = addDays(r.week, 7);
  const phoneOff = formatClock(hhmm(t.profile?.phone_off_time ?? '21:30'));
  const kicker = `Weekly review · ${shortDay(sunday)} · ${formatClock(REVIEW_TIME)}`;
  const close = () => router.back();
  const delta = s.avgScore !== null && s.prevScore !== null ? s.avgScore - s.prevScore : null;
  const missedDays = s.worst?.missed.map((d) => DAY_NAMES[isoWeekday(d) - 1]).join(', ');

  const save = () => {
    void dispatch(applyChanges(planReview(r.week, r.existing, s, wentWell, change)));
    showSnackbar({ message: 'Review saved' });
    setStep(3);
  };

  if (step === 2)
    return (
      <Screen
        title="Reflect"
        kicker={kicker}
        subtitle="Two lines. Be specific: a time, a place, a number."
        withTabBar={false}
        back={{ label: 'Close', onPress: close }}
        accessory={<Steps step={2} />}
      >
        <Field label="What went well" value={wentWell} onChange={setWentWell} />
        <Field label="What I change next week" value={change} onChange={setChange} />
        <Text variant="caption" tone="secondary">
          One change only works better than three. It shows on Today all next week.
        </Text>
        <View style={styles.chips}>
          {changeIdeas(s, {
            proteinG: t.profile?.protein_target_g ?? 150,
            sleepH: 7,
            phoneOff,
          }).map((idea) => (
            <Chip
              key={idea}
              label={idea}
              leadingIcon={Plus}
              accessibilityLabel={`Use: ${idea}`}
              onPress={() =>
                setChange((c) =>
                  (c.trim() ? `${c.trim()} ${idea}.` : `${idea}.`).slice(0, TEXT_MAX),
                )
              }
            />
          ))}
        </View>
        <Button label="Save review" accessibilityLabel="Save review" fullWidth onPress={save} />
        <Button
          variant="secondary"
          label="Back"
          accessibilityLabel="Back to the numbers"
          fullWidth
          onPress={() => setStep(1)}
        />
      </Screen>
    );

  if (step === 3)
    return (
      <Screen
        title="Done for this week"
        kicker={kicker}
        withTabBar={false}
        back={{ label: 'Close', onPress: close }}
        accessory={<Steps step={3} />}
      >
        <Card testID="saved">
          <View style={styles.center}>
            <View style={[styles.check, { backgroundColor: colors.accents.success.base }]}>
              <Check size={28} color={colors.onButton} strokeWidth={3} />
            </View>
            <Text variant="heading">Review saved</Text>
            <Text variant="sub" tone="secondary">
              {[weekLabel(r.week), s.avgScore !== null ? `${s.avgScore}%` : null, grade?.grade]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          </View>
        </Card>
        {change.trim() ? (
          <Card kicker="Your change for next week" testID="change-card">
            <Text variant="body" weight={700}>{`“${change.trim()}”`}</Text>
            <View style={styles.row}>
              <CalendarDays size={16} color={colors.accents.primary.base} />
              <Text
                variant="caption"
                tone="secondary"
              >{`Pinned to Today all week, starting ${shortDay(nextMonday)}`}</Text>
            </View>
            <View style={styles.row}>
              <Clock size={16} color={colors.accents.primary.base} />
              <Text
                variant="caption"
                tone="secondary"
              >{`Next review ${shortDay(addDays(sunday, 7))}, ${formatClock(REVIEW_TIME)}`}</Text>
            </View>
          </Card>
        ) : null}
        <Button label="Close" accessibilityLabel="Close the review" fullWidth onPress={close} />
        <Button
          variant="secondary"
          label="Edit review"
          accessibilityLabel="Edit review"
          fullWidth
          onPress={() => setStep(2)}
        />
      </Screen>
    );

  return (
    <Screen
      title="Your week in numbers"
      kicker={kicker}
      subtitle={`${dayMonth(r.week)}–${dayMonth(sunday)}${r.templates ? ` · ${r.templates}` : ''}`}
      withTabBar={false}
      back={{ label: 'Close', onPress: close }}
      accessory={<Steps step={1} />}
    >
      {r.offline ? (
        <Text variant="caption" tone="secondary">
          Couldn’t load the week’s numbers. Connect and reopen; you can still write the review.
        </Text>
      ) : null}
      <Card testID="score-card">
        <View style={styles.row}>
          <Ring
            progress={(s.avgScore ?? 0) / 100}
            accent="primary"
            size={104}
            strokeWidth={10}
            accessibilityLabel={`Average day score ${s.avgScore ?? 'none'} percent`}
          >
            <Text variant="heading" num>
              {s.avgScore === null ? '—' : `${s.avgScore}%`}
            </Text>
          </Ring>
          <View style={styles.flex}>
            <View style={styles.row}>
              <Text variant="title" style={styles.grade}>
                {grade?.grade ?? 'No score'}
              </Text>
              {grade ? <StatusChip label={grade.band} tone="neutral" /> : null}
            </View>
            <Text variant="caption" tone="secondary">
              {s.avgScore === null
                ? 'No day scores this week'
                : `Avg day score ${s.avgScore}%${s.prevScore !== null ? ` · last week ${s.prevScore}% (${signed(delta ?? 0, '')})` : ''}`}
            </Text>
          </View>
        </View>
      </Card>

      <View style={styles.tiles}>
        <StatTile
          label="Streak days"
          accent="success"
          value={String(s.streakDays)}
          sub="this week"
          style={styles.tile}
        />
        <StatTile
          label="Sessions"
          accent="protein"
          value={String(s.sessions)}
          sub="done ≥ 80%"
          style={styles.tile}
        />
        <StatTile
          label="Protein avg"
          accent="protein"
          value={s.avgProtein === null ? '—' : `${Math.round(s.avgProtein)} g`}
          sub={
            s.avgKcal === null
              ? `target ${t.profile?.protein_target_g ?? 150} g`
              : `${s.avgKcal} kcal avg`
          }
          style={styles.tile}
        />
        <StatTile
          label="Weight"
          accent="success"
          value={s.weightChange === null ? '—' : `${signed(s.weightChange, ' kg')}`}
          sub="7-day avg change"
          style={styles.tile}
        />
        <StatTile
          label="Sleep avg"
          accent="danger"
          value={s.avgSleep === null ? '—' : `${s.avgSleep} h`}
          sub="target 7 h"
          style={styles.tile}
        />
        <StatTile
          label="Spend"
          accent="primary"
          value={formatInr(s.spend)}
          sub="debits this week"
          style={styles.tile}
        />
      </View>

      <Card testID="worst-block">
        <View style={styles.row}>
          <Text variant="kicker" tone="secondary" style={styles.flex}>
            Worst block
          </Text>
          {s.worst ? (
            <StatusChip label={`${s.worst.done} of ${s.worst.scheduled} days`} tone="danger" />
          ) : null}
        </View>
        {s.worst ? (
          <>
            <View style={styles.row}>
              <Text variant="heading" style={styles.flex}>
                {s.worst.title}
              </Text>
              <Text variant="metric" num style={{ color: colors.accents.danger.base }}>
                {`${s.worst.pct}%`}
              </Text>
            </View>
            <View style={[styles.track, { backgroundColor: colors.recessed }]}>
              <View
                style={[
                  styles.fill,
                  {
                    width: `${Math.max(s.worst.pct, 2)}%`,
                    backgroundColor: colors.accents.danger.base,
                  },
                ]}
              />
            </View>
            <Text variant="sub" tone="secondary">
              {`Missed ${missedDays}. It sits at ${formatClock(hhmm(s.worst.startTime))}.`}
            </Text>
          </>
        ) : (
          <Text variant="sub" tone="secondary">
            Every ticked block was done on every day. Nothing to fix here.
          </Text>
        )}
      </Card>

      <Button
        label="Next: reflect"
        accessibilityLabel="Next: reflect"
        fullWidth
        onPress={() => setStep(2)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  dots: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  dot: { height: 8, borderRadius: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  flex: { flex: 1 },
  grade: { fontSize: 28, lineHeight: 34 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { width: '48%', flexGrow: 1 },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
  gap6: { gap: 6 },
  input: {
    minHeight: 96,
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 14,
    fontSize: 16,
    textAlignVertical: 'top',
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  center: { alignItems: 'center', gap: 8, paddingVertical: 8 },
  check: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
