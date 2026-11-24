import { Check, Clock, Droplet, Dumbbell, Lock, Soup, TriangleAlert } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { hhmm } from '@/features/routine/lib/blocks';
import { formatClock } from '@/lib/format';
import { Button, Card, Checkbox, StatusChip, Text, useTheme } from '@/ui';

import type { fallback, NudgeRowInput, RecoveryOption, Rescue } from '../lib/rules';

const at = (t: string) => formatClock(hhmm(t));

/** Design Acc-Interrupt: full-width red card, one thing now, snooze 15 min. */
export function InterruptCard({
  overdue,
  target,
  nowText,
  detail,
  onDone,
  onSnooze,
}: {
  overdue: number;
  target: NudgeRowInput;
  nowText: string;
  detail: string;
  onDone: () => void;
  onSnooze: () => void;
}) {
  const { colors } = useTheme();
  const water = target.block.kind === 'water';
  return (
    <View
      style={[styles.interrupt, { backgroundColor: colors.buttonDestructive }]}
      testID="interrupt-card"
      accessible={false}
    >
      <View style={styles.row}>
        <TriangleAlert size={16} color={colors.onButton} />
        <Text variant="kicker" tone="onButton">{`${overdue} blocks overdue · ${nowText}`}</Text>
      </View>
      <Text
        variant="title"
        tone="onButton"
        style={styles.big}
      >{`Do ONE thing now: ${target.block.title}.`}</Text>
      <Text variant="sub" tone="onButton">{`${detail} Everything else can wait 2 minutes.`}</Text>
      <Pressable
        onPress={onDone}
        accessibilityRole="button"
        accessibilityLabel={
          water ? `Done: log ${target.block.title}` : `Done: ${target.block.title}`
        }
        style={[styles.white, { backgroundColor: colors.onButton }]}
      >
        {water ? (
          <Droplet size={18} color={colors.buttonDestructive} />
        ) : (
          <Check size={18} color={colors.buttonDestructive} />
        )}
        <Text variant="button" style={{ color: colors.buttonDestructive }}>
          {water ? `Done · log it` : 'Done'}
        </Text>
      </Pressable>
      <Pressable
        onPress={onSnooze}
        accessibilityRole="button"
        accessibilityLabel="Not now (snooze 15 min)"
        style={styles.center}
      >
        <Text variant="sub" tone="onButton" weight={700} style={styles.underline}>
          Not now (snooze 15 min)
        </Text>
      </Pressable>
    </View>
  );
}

/** Design Acc-Recovery: yesterday's misses, pick today's one non-negotiable. */
export function RecoveryCard({
  yesterdayScore,
  missed,
  options,
  graceLine,
  onLock,
  onDismiss,
}: {
  yesterdayScore: number;
  missed: readonly string[];
  options: readonly RecoveryOption[];
  graceLine: string;
  onLock: (o: RecoveryOption) => void;
  onDismiss: () => void;
}) {
  const { colors } = useTheme();
  const [pick, setPick] = useState(options[0]?.clientId ?? null);
  const chosen = options.find((o) => o.clientId === pick) ?? null;
  return (
    <Card
      testID="recovery-card"
      style={{ borderColor: colors.accents.danger.base, borderWidth: 1.5 }}
    >
      <View style={styles.row}>
        <Text variant="kicker" tone="secondary" style={styles.flex}>
          Missed-day recovery
        </Text>
        <Text variant="caption" tone="secondary">
          {graceLine}
        </Text>
      </View>
      <Text variant="heading">
        {`Yesterday: ${yesterdayScore}%.${missed.length ? ` Missed: ${missed.slice(0, 3).join(', ').toLowerCase()}.` : ''}`}
      </Text>
      <Text variant="body" weight={600}>
        Pick today’s one non-negotiable.
      </Text>
      {options.map((o) => {
        const on = o.clientId === pick;
        return (
          <Pressable
            key={o.clientId}
            onPress={() => setPick(o.clientId)}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            accessibilityLabel={`${o.title} at ${at(o.start)}`}
            style={[
              styles.option,
              { borderColor: on ? colors.accents.primary.base : colors.hairline },
            ]}
          >
            <View
              style={[
                styles.radio,
                { borderColor: on ? colors.accents.primary.base : colors.textSecondary },
              ]}
            >
              {on ? (
                <View style={[styles.dot, { backgroundColor: colors.accents.primary.base }]} />
              ) : null}
            </View>
            <View style={styles.flex}>
              <Text variant="body" weight={700}>
                {o.title}
              </Text>
              <Text variant="caption" tone="secondary">
                {at(o.start)}
              </Text>
            </View>
          </Pressable>
        );
      })}
      <Button
        icon={Check}
        label="Lock it in"
        accessibilityLabel="Lock it in"
        fullWidth
        disabled={!chosen}
        onPress={() => chosen && onLock(chosen)}
      />
      <Button
        size="sm"
        variant="ghost"
        label="Not today"
        accessibilityLabel="Dismiss missed-day recovery"
        onPress={onDismiss}
      />
    </Card>
  );
}

/** The locked-in non-negotiable, pinned at the top of Today. */
export function PinnedCard({ row, onDone }: { row: NudgeRowInput; onDone: () => void }) {
  const { colors } = useTheme();
  const done = row.state === 'done';
  return (
    <Card padding={14} testID="pinned-card" style={{ borderColor: colors.accents.primary.base }}>
      <View style={styles.row}>
        <Lock size={16} color={colors.accents.primary.base} />
        <Text variant="kicker" style={[styles.flex, { color: colors.accents.primary.base }]}>
          Today’s one non-negotiable
        </Text>
        {done ? <StatusChip label="Done" tone="success" /> : null}
      </View>
      <View style={styles.row}>
        <Text variant="heading" style={styles.flex}>
          {row.block.title}
        </Text>
        {done ? null : (
          <Button
            size="sm"
            label="Done"
            accessibilityLabel={`Mark ${row.block.title} done`}
            onPress={onDone}
          />
        )}
      </View>
      <Text
        variant="caption"
        tone="secondary"
      >{`${at(row.block.start_time)} · ${row.block.duration_min} min`}</Text>
    </Card>
  );
}

const RESCUE_ICON: Record<Rescue, typeof Soup> = {
  rescue_eggs: Soup,
  rescue_walk: Clock,
  rescue_water: Droplet,
  rescue_plank: Dumbbell,
};

/** Design Acc-Fallback: after 6 pm under 50 %, four one-tap rescues with real gains. */
export function FallbackCard({
  f,
  nowText,
  waterLine,
  onRescue,
}: {
  f: ReturnType<typeof fallback>;
  nowText: string;
  waterLine: string;
  onRescue: (kind: Rescue) => void;
}) {
  const { colors } = useTheme();
  const left = f.actions.filter((a) => !a.done);
  return (
    <Card
      testID="fallback-card"
      style={{ borderColor: colors.accents.calories.base, borderWidth: 1.5 }}
    >
      <View style={styles.row}>
        <Text variant="kicker" tone="secondary" style={styles.flex}>
          Fallback mode
        </Text>
        <Text variant="caption" tone="secondary">
          after 6 pm · score under 50%
        </Text>
      </View>
      <Text variant="heading">{`${f.score}% at ${nowText}. The full plan is gone. Save the day.`}</Text>
      <Text variant="sub" tone="secondary">
        {left.length === 0
          ? 'All four done. That’s the day saved as far as it can be.'
          : `All ${left.length === 4 ? '4' : `${left.length} left`} lift you to ${f.allTo}%: ${
              f.saves === 'streak'
                ? 'a streak day.'
                : f.saves === 'grace'
                  ? 'a grace day, streak kept.'
                  : 'not enough to keep the streak, but better.'
            }`}
      </Text>
      <View style={styles.grid}>
        {f.actions.map((a) => {
          const Icon = RESCUE_ICON[a.kind];
          return (
            <Pressable
              key={a.kind}
              disabled={a.done}
              onPress={() => onRescue(a.kind)}
              accessibilityRole="button"
              accessibilityState={{ disabled: a.done }}
              accessibilityLabel={a.done ? `${a.title}: done` : `${a.title}, plus ${a.gain} points`}
              style={[
                styles.tile,
                {
                  borderColor: colors.hairline,
                  backgroundColor: colors.recessed,
                  opacity: a.done ? 0.55 : 1,
                },
              ]}
            >
              <Icon size={20} color={colors.accents.calories.base} />
              <Text variant="body" weight={700}>
                {a.title}
              </Text>
              <Text variant="caption" tone="secondary">
                {a.kind === 'rescue_water' ? waterLine : a.sub}
              </Text>
              <Text
                variant="caption"
                weight={700}
                style={{ color: a.done ? colors.textSecondary : colors.accents.success.base }}
              >
                {a.done ? 'Done' : `+${a.gain} pts`}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </Card>
  );
}

const HONESTY = [
  ['Exact portions', 'Weighed rice and curry, not eyeballed'],
  ['No unlogged snacks', 'Office biscuits, tea with sugar, bites while cooking'],
  ['Eating out logged honestly', 'Not logged as “plan”'],
  ['Every set done', 'Not just ticked: logged with reps'],
] as const;

/** Design Acc-Reality: two numbers that can't both be true, honesty checklist, two ways out. */
export function RealityCard({
  r,
  onStrict,
  onWater,
}: {
  r: { days: number; from: number; to: number; gain: number; avgScore: number; deficit: number };
  onStrict: () => void;
  onWater: () => void;
}) {
  const { colors } = useTheme();
  const [ticks, setTicks] = useState<boolean[]>([false, false, false, false]);
  return (
    <Card testID="reality-card" style={{ borderColor: colors.text, borderWidth: 1.5 }}>
      <View style={styles.row}>
        <Text variant="kicker" tone="secondary" style={styles.flex}>
          Reality check
        </Text>
        <Text variant="caption" tone="secondary">{`${r.days} days`}</Text>
      </View>
      <Text variant="heading">{`Weight +${r.gain} kg in ${r.days} days. Day scores averaged ${r.avgScore}%.`}</Text>
      <Text
        variant="caption"
        tone="secondary"
      >{`7-day avg ${r.from.toFixed(1)} → ${r.to.toFixed(1)} kg · logged deficit ${r.deficit} kcal/day`}</Text>
      <Text variant="sub">
        Both can’t be true. Either the logs are off or something isn’t logged. Answer honestly:
      </Text>
      {HONESTY.map(([title, sub], i) => (
        <View key={title} style={[styles.check, { borderTopColor: colors.hairline }]}>
          <Checkbox
            checked={ticks[i]!}
            onToggle={(v) => setTicks(ticks.map((x, j) => (j === i ? v : x)))}
            accessibilityLabel={title}
          />
          <View style={styles.flex}>
            <Text variant="body" weight={600}>
              {title}
            </Text>
            <Text variant="caption" tone="secondary">
              {sub}
            </Text>
          </View>
        </View>
      ))}
      <Button
        label="Strict week: weigh food for 7 days"
        accessibilityLabel="Strict week: weigh food for 7 days"
        fullWidth
        onPress={onStrict}
      />
      <Button
        variant="secondary"
        label="It’s water (new workout, salty meals)"
        accessibilityLabel="It’s water (new workout, salty meals)"
        fullWidth
        onPress={onWater}
      />
    </Card>
  );
}

/** 7 straight days at 100 %: audit day. */
export function AuditCard({ onDone }: { onDone: () => void }) {
  return (
    <Card testID="audit-card">
      <Text variant="kicker" tone="secondary">
        Reality check
      </Text>
      <Text variant="heading">7 days at 100%. Audit day.</Text>
      <Text variant="sub" tone="secondary">
        Today: weigh every portion and log every set with its reps. If the numbers hold, keep going.
      </Text>
      <Button label="Got it" accessibilityLabel="Got it: audit day" onPress={onDone} />
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flex: { flex: 1 },
  interrupt: { borderRadius: 20, padding: 18, gap: 10 },
  big: { fontSize: 28, lineHeight: 34 },
  white: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    height: 52,
  },
  center: { alignItems: 'center', minHeight: 44, justifyContent: 'center' },
  underline: { textDecorationLine: 'underline' },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 12,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { width: '47%', flexGrow: 1, borderWidth: 1, borderRadius: 14, padding: 12, gap: 4 },
  check: { flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: 1, paddingTop: 10 },
});
