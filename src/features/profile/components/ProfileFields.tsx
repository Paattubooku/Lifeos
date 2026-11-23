import { Info, Moon, Smartphone, Sun, type LucideIcon } from 'lucide-react-native';
import { type ReactNode, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { Sex } from '@/features/body/lib/energy';
import type { DateString } from '@/lib/dates';
import { formatClock, formatIndianNumber } from '@/lib/format';
import { Banner, Card, InlineStepper, StatTile, Text, TimePicker, useTheme } from '@/ui';

import {
  bodySummary,
  checkDay,
  energyPlan,
  formatDuration,
  LIMITS,
  type ProfileFields,
} from '../lib/targets';

type FieldsProps = {
  value: ProfileFields;
  onChange: (patch: Partial<ProfileFields>) => void;
};

/** Divider-separated rows inside one card (Onboarding designs). */
function FieldCard({ children }: { children: ReactNode[] }) {
  const { colors } = useTheme();
  return (
    <Card padding={0} gap={0} style={styles.fieldCard}>
      {children.map((child, i) => (
        <View
          key={i}
          style={i > 0 ? { borderTopWidth: 1, borderTopColor: colors.hairline } : undefined}
        >
          {child}
        </View>
      ))}
    </Card>
  );
}

const kg = (n: number) => n.toFixed(1);

/** Step 1 · Body */
export function BodyFields({
  value,
  onChange,
  today,
  showCurrentWeight = true,
}: FieldsProps & { today: DateString; showCurrentWeight?: boolean }) {
  const s = bodySummary(value, today);
  const weightStep = LIMITS.weight_kg;
  return (
    <View style={styles.section}>
      <FieldCard>
        {[
          <InlineStepper
            key="h"
            label="Height"
            value={value.height_cm}
            onChange={(v) => onChange({ height_cm: v })}
            {...LIMITS.height_cm}
            unit="cm"
          />,
          ...(showCurrentWeight
            ? [
                <InlineStepper
                  key="w"
                  label="Current weight"
                  hint="0.1 kg steps"
                  value={value.current_weight_kg}
                  onChange={(v) => onChange({ current_weight_kg: v })}
                  {...weightStep}
                  decimals={1}
                  unit="kg"
                />,
              ]
            : []),
          <InlineStepper
            key="g"
            label="Goal weight"
            value={value.goal_weight_kg}
            onChange={(v) => onChange({ goal_weight_kg: v })}
            {...weightStep}
            decimals={1}
            unit="kg"
          />,
        ]}
      </FieldCard>
      <View style={styles.tiles}>
        <StatTile label="To lose" value={s.toLoseKg > 0 ? kg(s.toLoseKg) : '0.0'} sub="kg" />
        <StatTile
          label="BMI now"
          value={s.bmiNow.toFixed(1)}
          sub={`goal ${s.bmiGoal.toFixed(1)}`}
        />
      </View>
      <Text variant="sub" tone="secondary">
        {s.weeks !== null && s.eta
          ? `Plain maths: at 0.5 kg a week this takes ${s.weeks} weeks (${s.eta}). Your calorie target on step 3 decides the real pace.`
          : 'Goal is at or above your current weight: no deficit needed.'}
      </Text>
    </View>
  );
}

type TimeKey = 'wake_time' | 'phone_off_time' | 'sleep_time';

const TIME_ROWS: { key: TimeKey; title: string; sub: string; icon: LucideIcon }[] = [
  { key: 'wake_time', title: 'Wake', sub: 'Day starts, timeline begins', icon: Sun },
  { key: 'phone_off_time', title: 'Phone off', sub: 'Blunt reminder, no snooze', icon: Smartphone },
  { key: 'sleep_time', title: 'Sleep', sub: 'Lights out', icon: Moon },
];

/** Step 2 · Day: three time rows; the wheel edits the selected one. */
export function DayFields({ value, onChange }: FieldsProps) {
  const { colors } = useTheme();
  const [selected, setSelected] = useState<TimeKey>('wake_time');
  const check = checkDay(value);
  const current = TIME_ROWS.find((r) => r.key === selected) ?? TIME_ROWS[0]!;

  return (
    <View style={styles.section}>
      <Card padding={8} gap={4}>
        {TIME_ROWS.map((row) => {
          const active = row.key === selected;
          const Icon = row.icon;
          return (
            <Pressable
              key={row.key}
              accessibilityRole="radio"
              accessibilityLabel={`${row.title}, ${formatClock(value[row.key])}`}
              accessibilityState={{ checked: active }}
              onPress={() => setSelected(row.key)}
              style={[
                styles.timeRow,
                active && {
                  backgroundColor: colors.recessed,
                  borderColor: colors.accents.primary.base,
                },
              ]}
            >
              <Icon size={18} color={colors.textSecondary} strokeWidth={2} />
              <View style={styles.flex}>
                <Text variant="body" weight={600}>
                  {row.title}
                </Text>
                <Text variant="caption" tone="secondary">
                  {row.sub}
                </Text>
              </View>
              <Text variant="heading" num>
                {formatClock(value[row.key])}
              </Text>
            </Pressable>
          );
        })}
      </Card>
      <TimePicker
        accessibilityLabel={current.title}
        value={value[selected]}
        onChange={(t) => onChange({ [selected]: t } as Partial<ProfileFields>)}
      />
      {check.error ? (
        <Banner tone="danger" title={check.error} testID="day-error" />
      ) : (
        <Text variant="sub" tone="secondary">
          {`Sleep window: ${formatDuration(check.sleepWindowMin)}. Phone-off is ${formatDuration(
            check.phoneOffBeforeSleepMin,
          )} before sleep.`}
        </Text>
      )}
    </View>
  );
}

/** Step 3 · Targets, with the deficit banner. */
export function TargetsFields({
  value,
  onChange,
  today,
  person,
}: FieldsProps & {
  today: DateString;
  person: { sex: Sex; birthYear: number; activityFactor: number };
}) {
  const plan = energyPlan(value, person, today);
  const deficitTitle =
    plan.deficit > 0
      ? `~${formatIndianNumber(plan.deficit)} kcal deficit ≈ ${plan.kgPerWeek.toFixed(1)} kg/week`
      : `No deficit at ${formatIndianNumber(value.kcal_target)} kcal`;
  const deficitBody = [
    plan.goalMonth
      ? `At this pace ${kg(value.goal_weight_kg)} kg is about ${plan.goalMonth}.`
      : null,
    plan.suggestedKcal
      ? `${formatIndianNumber(plan.suggestedKcal)} kcal gets you to ~0.5 kg/week.`
      : null,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <View style={styles.section}>
      <FieldCard>
        {[
          <InlineStepper
            key="water"
            label="Water"
            hint="250 ml steps · pace 5:00 am–9:00 pm"
            value={value.water_target_ml}
            onChange={(v) => onChange({ water_target_ml: v })}
            {...LIMITS.water_target_ml}
            unit="ml"
            format={(n) => formatIndianNumber(n)}
          />,
          <InlineStepper
            key="kcal"
            label="Calories"
            hint={`Est. maintenance ~${formatIndianNumber(plan.maintenance)} kcal`}
            value={value.kcal_target}
            onChange={(v) => onChange({ kcal_target: v })}
            {...LIMITS.kcal_target}
            unit="kcal"
            format={(n) => formatIndianNumber(n)}
          />,
          <InlineStepper
            key="protein"
            label="Protein"
            hint={`≈ ${plan.proteinPerKg.toFixed(2)} g per kg body weight`}
            value={value.protein_target_g}
            onChange={(v) => onChange({ protein_target_g: v })}
            {...LIMITS.protein_target_g}
            unit="g"
          />,
          <InlineStepper
            key="coffee"
            label="Coffee"
            hint="Counted, not banned"
            value={value.coffee_limit}
            onChange={(v) => onChange({ coffee_limit: v })}
            {...LIMITS.coffee_limit}
            unit="max"
          />,
        ]}
      </FieldCard>
      <Banner
        tone={plan.deficit > 0 ? 'info' : 'warning'}
        icon={Info}
        title={deficitTitle}
        body={deficitBody || undefined}
        action={
          plan.suggestedKcal
            ? {
                label: `Use ${formatIndianNumber(plan.suggestedKcal)}`,
                accessibilityLabel: `Use ${plan.suggestedKcal} kilocalories`,
                onPress: () => onChange({ kcal_target: plan.suggestedKcal as number }),
              }
            : undefined
        }
        testID="deficit-banner"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 16 },
  fieldCard: { paddingHorizontal: 16 },
  tiles: { flexDirection: 'row', gap: 8 },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 60,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  flex: { flex: 1, minWidth: 0 },
});
