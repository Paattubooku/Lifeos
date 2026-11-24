import { Info, Moon, Smartphone, Sun, type LucideIcon } from 'lucide-react-native';
import { type ReactNode, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { Sex } from '@/features/body/lib/energy';
import type { DateString } from '@/lib/dates';
import { formatClock, formatIndianNumber } from '@/lib/format';
import {
  Banner,
  Card,
  InlineStepper,
  SegmentedToggle,
  StatTile,
  Text,
  TextField,
  TimePicker,
  useTheme,
} from '@/ui';

import {
  bodySummary,
  checkDay,
  energyPlan,
  formatDuration,
  ACTIVITY_LEVELS,
  LIMITS,
  personOf,
  type ProfileFields,
  type WeighInMode,
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
}: FieldsProps & {
  today: DateString;
}) {
  const plan = energyPlan(value, personOf(value), today);
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
            hint={`250 ml steps · paced from ${formatClock(value.wake_time)}`}
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

/**
 * F25: a number typed from blank, with the example plan as the placeholder
 * ("e.g. 170"). Out-of-range text shows the range; empty means not answered.
 */
export function NumberField({
  label,
  value,
  onChange,
  example,
  limits,
  decimals = 0,
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  example: number;
  limits: { min: number; max: number };
  decimals?: number;
}) {
  const [text, setText] = useState(value === null ? '' : String(value));
  // The range shows once the person leaves the box, not while "1", "19"… are typed.
  const [touched, setTouched] = useState(false);
  // Only tell the parent when the parsed answer changes (not on every key).
  const sent = useRef<number | null>(value);
  const parse = (t: string): number | null => {
    const v = Number(t.replace(',', '.'));
    const ok = t.trim() !== '' && Number.isFinite(v) && v >= limits.min && v <= limits.max;
    return ok ? Math.round(v * 10 ** decimals) / 10 ** decimals : null;
  };
  const bad = touched && text.trim() !== '' && parse(text) === null;
  return (
    <TextField
      label={label}
      value={text}
      placeholder={`e.g. ${example}`}
      keyboardType={decimals > 0 ? 'decimal-pad' : 'number-pad'}
      maxLength={6}
      error={bad ? `${limits.min}–${limits.max}` : null}
      onBlur={() => setTouched(true)}
      onChangeText={(t) => {
        setText(t);
        const next = parse(t);
        if (next !== sent.current) {
          sent.current = next;
          onChange(next);
        }
      }}
    />
  );
}

const SEX_OPTIONS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
] as const;
const WEIGH_OPTIONS = [
  { value: 'daily', label: 'Every day' },
  { value: 'weekly', label: 'Once a week' },
] as const;

type AboutValue = {
  sex: Sex;
  birth_year: number | null;
  height_cm: number | null;
  activity_factor: number;
};

/** F25 · About you: sex, birth year, (height), activity level. */
export function AboutFields({
  value,
  onChange,
  example,
  showHeight = true,
}: {
  value: AboutValue;
  onChange: (patch: Partial<AboutValue>) => void;
  example: ProfileFields;
  showHeight?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.section}>
      <View style={styles.gap}>
        <Text variant="sub" weight={600}>
          Sex (for the calorie formula)
        </Text>
        <SegmentedToggle
          options={SEX_OPTIONS}
          value={value.sex}
          onChange={(sex) => onChange({ sex })}
          accessibilityLabel="Sex"
        />
      </View>
      <NumberField
        label="Birth year"
        value={value.birth_year}
        onChange={(birth_year) => onChange({ birth_year })}
        example={example.birth_year}
        limits={LIMITS.birth_year}
      />
      {showHeight ? (
        <NumberField
          label="Height (cm)"
          value={value.height_cm}
          onChange={(height_cm) => onChange({ height_cm })}
          example={example.height_cm}
          limits={LIMITS.height_cm}
        />
      ) : null}
      <Card title="How active is your day?" padding={8} gap={4}>
        {ACTIVITY_LEVELS.map((a) => {
          const active = a.factor === value.activity_factor;
          return (
            <Pressable
              key={a.factor}
              accessibilityRole="radio"
              accessibilityLabel={`${a.title}. ${a.sub}`}
              accessibilityState={{ checked: active }}
              onPress={() => onChange({ activity_factor: a.factor })}
              style={[
                styles.timeRow,
                active && {
                  backgroundColor: colors.recessed,
                  borderColor: colors.accents.primary.base,
                },
              ]}
            >
              <View style={styles.flex}>
                <Text variant="body" weight={600}>
                  {a.factor === example.activity_factor ? `${a.title} · example` : a.title}
                </Text>
                <Text variant="caption" tone="secondary">
                  {a.sub}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </Card>
    </View>
  );
}

/** F25 · Weight: current and goal typed from blank, weigh-in habit, then the plain maths. */
export function WeightFields({
  value,
  onChange,
  example,
  today,
}: {
  value: {
    height_cm: number | null;
    current_weight_kg: number | null;
    goal_weight_kg: number | null;
    weigh_in_mode: WeighInMode;
  };
  onChange: (patch: {
    current_weight_kg?: number | null;
    goal_weight_kg?: number | null;
    weigh_in_mode?: WeighInMode;
  }) => void;
  example: ProfileFields;
  today: DateString;
}) {
  const { height_cm, current_weight_kg, goal_weight_kg } = value;
  const s =
    height_cm !== null && current_weight_kg !== null && goal_weight_kg !== null
      ? bodySummary({ height_cm, current_weight_kg, goal_weight_kg }, today)
      : null;
  return (
    <View style={styles.section}>
      <NumberField
        label="Current weight (kg)"
        value={current_weight_kg}
        onChange={(v) => onChange({ current_weight_kg: v })}
        example={example.current_weight_kg}
        limits={LIMITS.weight_kg}
        decimals={1}
      />
      <NumberField
        label="Goal weight (kg)"
        value={goal_weight_kg}
        onChange={(v) => onChange({ goal_weight_kg: v })}
        example={example.goal_weight_kg}
        limits={LIMITS.weight_kg}
        decimals={1}
      />
      <View style={styles.gap}>
        <Text variant="sub" weight={600}>
          Weigh in
        </Text>
        <SegmentedToggle
          options={WEIGH_OPTIONS}
          value={value.weigh_in_mode}
          onChange={(weigh_in_mode) => onChange({ weigh_in_mode })}
          accessibilityLabel="Weigh in"
        />
      </View>
      {s ? (
        <>
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
              ? `Plain maths: at 0.5 kg a week this takes ${s.weeks} weeks (${s.eta}).`
              : 'Goal is at or above your current weight: no deficit needed.'}
          </Text>
        </>
      ) : null}
    </View>
  );
}

/** F25 · Steps minimum and monthly budget (onboarding step 4). */
export function HabitFields({ value, onChange }: FieldsProps) {
  return (
    <FieldCard>
      {[
        <InlineStepper
          key="steps"
          label="Steps a day"
          hint="Minimum that counts as a good day"
          value={value.steps_min}
          onChange={(v) => onChange({ steps_min: v })}
          {...LIMITS.steps_min}
          unit="steps"
          format={(n) => formatIndianNumber(n)}
        />,
        <InlineStepper
          key="budget"
          label="Monthly budget"
          hint="Spending limit for Money"
          value={value.monthly_budget_inr}
          onChange={(v) => onChange({ monthly_budget_inr: v })}
          {...LIMITS.monthly_budget_inr}
          unit="₹"
          format={(n) => formatIndianNumber(n)}
        />,
      ]}
    </FieldCard>
  );
}

const styles = StyleSheet.create({
  section: { gap: 16 },
  gap: { gap: 8 },
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
