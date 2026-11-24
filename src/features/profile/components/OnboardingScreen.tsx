import { useRouter } from 'expo-router';
import { ChevronLeft, Clock, Droplet, Smartphone } from 'lucide-react-native';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useMealPlan } from '@/features/food/hooks/useFood';
import { templateForDate, templateLabel } from '@/features/routine/lib/templates';
import { formatClock, formatIndianNumber } from '@/lib/format';
import { enableReminders } from '@/lib/notifications';
import { useAppDispatch, useAppSelector } from '@/store';
import { Button, Card, Text, useTheme } from '@/ui';

import { useProfileContext } from '../hooks/useProfileData';
import {
  completeFields,
  EXAMPLE,
  newDraft,
  ONBOARDING_STEPS,
  type OnboardingDraft,
  planFirstRun,
  stepError,
  suggestTargets,
} from '../lib/onboarding';
import type { ProfileFields } from '../lib/targets';
import { applyWrites, draftCleared, draftStarted, draftUpdated } from '../slice';
import { AboutFields, DayFields, HabitFields, TargetsFields, WeightFields } from './ProfileFields';

export { ONBOARDING_STEPS };

const ex = EXAMPLE;
const TITLES: Record<number, { title: string; subtitle: string }> = {
  1: {
    title: 'About you',
    subtitle: 'Used for your calorie and protein targets. Only you see this.',
  },
  2: { title: 'Weight', subtitle: 'Where you are now and where you want to be.' },
  3: {
    title: 'Your day',
    subtitle: `Your routine and meals are fitted between these times. Example: wake ${formatClock(ex.wake_time)}, phone off ${formatClock(ex.phone_off_time)}, sleep ${formatClock(ex.sleep_time)}.`,
  },
  4: {
    title: 'Targets',
    subtitle: 'Suggested from your answers. Change anything now or later in More.',
  },
  // PRD F15 caps reminders at 10/day (the design's "8" is mock copy).
  5: { title: 'Notifications', subtitle: 'Max 10 a day. You can mute any of them.' },
};

export function clampStep(raw: string | string[] | undefined): number {
  const n = Number(Array.isArray(raw) ? raw[0] : raw);
  return Number.isInteger(n) && n >= 1 && n <= ONBOARDING_STEPS ? n : 1;
}

/** First-run setup 1…5 (F03 designs, extended for every new account in F25). */
export function OnboardingScreen({ step }: { step: number }) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const ctx = useProfileContext();
  const { plan: mealPlan } = useMealPlan();
  const draft = useAppSelector((s) => s.profile.draft);
  const [finishing, setFinishing] = useState(false);

  // Start the answers on first entry: blanks for the personal numbers.
  useEffect(() => {
    // Not while finishing: the draft is cleared before this screen unmounts.
    // Never once setup is saved: the step screens still mounted under the last one
    // must not start a blank draft when it is cleared (that bounced to step 1).
    if (!draft && ctx.profile && !ctx.profile.onboarded_at && !finishing)
      dispatch(draftStarted(newDraft(ctx.profile, ctx.latestWeightKg)));
  }, [ctx.profile, ctx.latestWeightKg, dispatch, draft, finishing]);

  const fields = draft ? completeFields(draft) : null;
  // Targets are suggested once, the first time step 4 opens.
  useEffect(() => {
    if (step === 4 && draft && fields && !draft.targetsSuggested)
      dispatch(draftUpdated({ ...suggestTargets(fields, ctx.today), targetsSuggested: true }));
  }, [step, draft, fields, ctx.today, dispatch]);

  if (!draft || !ctx.profile) return <Loading />;
  // Steps 3+ need the body answers (an app restart mid-way can land here).
  if (step >= 3 && !fields) return <Redirect to={1} />;

  const profile = ctx.profile;
  const update = (patch: Partial<OnboardingDraft>) => dispatch(draftUpdated(patch));
  const updateFields = (patch: Partial<ProfileFields>) => dispatch(draftUpdated(patch));
  const error = stepError(step, draft);

  const next = () =>
    router.push({ pathname: '/onboarding/[step]', params: { step: String(step + 1) } });

  const finish = async (allowNotifications: boolean) => {
    if (!fields) return;
    setFinishing(true);
    if (allowNotifications) await enableReminders();
    const writes = planFirstRun(profile, fields, {
      now: new Date(),
      today: ctx.today,
      blocks: ctx.blocks,
      meals: mealPlan.meals,
      templates: ctx.templates,
      todayDayLog: ctx.todayDayLog,
      todayWeight: ctx.todayWeight,
      program: ctx.program,
    });
    await dispatch(applyWrites(writes));
    dispatch(draftCleared());
    // No navigation here: with onboarded_at saved the root's guard closes the setup
    // screens and the start screen sends the person to the tour. Navigating here too
    // raced that switch and looped on iPhone ("Maximum update depth exceeded").
  };

  const { title, subtitle } = TITLES[step] ?? TITLES[1]!;

  return (
    <Frame
      step={step}
      title={title}
      subtitle={subtitle}
      onBack={step > 1 ? () => router.back() : undefined}
      footer={
        step < ONBOARDING_STEPS ? (
          <>
            {error ? (
              <Text variant="caption" tone="secondary" align="center">
                {error}
              </Text>
            ) : null}
            <Button
              size="lg"
              fullWidth
              label="Continue"
              accessibilityLabel="Continue"
              accessibilityHint={error ?? undefined}
              disabled={error !== null}
              onPress={next}
            />
          </>
        ) : (
          <>
            <Button
              size="lg"
              fullWidth
              label={finishing ? 'Setting up…' : 'Allow notifications'}
              accessibilityLabel="Allow notifications and finish"
              disabled={finishing}
              onPress={() => void finish(true)}
            />
            <Button
              variant="ghost"
              fullWidth
              label="Not now"
              accessibilityLabel="Skip notifications and finish"
              disabled={finishing}
              onPress={() => void finish(false)}
            />
          </>
        )
      }
    >
      {step === 1 ? <AboutFields value={draft} onChange={update} example={EXAMPLE} /> : null}
      {step === 2 ? (
        <WeightFields value={draft} onChange={update} example={EXAMPLE} today={ctx.today} />
      ) : null}
      {step === 3 && fields ? <DayFields value={fields} onChange={updateFields} /> : null}
      {step === 4 && fields ? (
        <View style={styles.section}>
          <TargetsFields value={fields} onChange={updateFields} today={ctx.today} />
          <HabitFields value={fields} onChange={updateFields} />
          <Text variant="caption" tone="secondary">
            {`Example plan: ${formatIndianNumber(ex.water_target_ml)} ml water · ${formatIndianNumber(ex.kcal_target)} kcal · ${ex.protein_target_g} g protein · ${ex.coffee_limit} coffees · ${formatIndianNumber(ex.steps_min)} steps · ₹${formatIndianNumber(ex.monthly_budget_inr)} a month.`}
          </Text>
        </View>
      ) : null}
      {step === 5 && fields ? (
        <NotificationsStep
          fields={fields}
          template={(() => {
            const t = templateForDate(ctx.templates, ctx.today);
            return t ? templateLabel(t) : '—';
          })()}
        />
      ) : null}
    </Frame>
  );
}

function Redirect({ to }: { to: number }) {
  const router = useRouter();
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    router.replace({ pathname: '/onboarding/[step]', params: { step: String(to) } });
  }, [router, to]);
  return <Loading />;
}

function NotificationsStep({ fields, template }: { fields: ProfileFields; template: string }) {
  const { colors } = useTheme();
  const items = [
    { icon: Clock, title: 'Block start', sub: 'One line at each block. No repeats.' },
    { icon: Droplet, title: 'Water pace', sub: 'Only when 300 ml+ behind.' },
    {
      icon: Smartphone,
      title: `Phone away · ${formatClock(fields.phone_off_time)}`,
      sub: 'Plus end-of-day score.',
    },
  ];
  const summary: [string, string][] = [
    [
      'Body',
      `${fields.height_cm} cm · ${fields.current_weight_kg.toFixed(1)} → ${fields.goal_weight_kg.toFixed(1)} kg`,
    ],
    ['Day', `${formatClock(fields.wake_time)} → ${formatClock(fields.sleep_time)}`],
    ['Phone off', formatClock(fields.phone_off_time)],
    [
      'Targets',
      `${formatIndianNumber(fields.water_target_ml)} ml · ${formatIndianNumber(fields.kcal_target)} kcal · ${fields.protein_target_g} g`,
    ],
    ['Template', template],
  ];
  const plan: [string, string][] = [
    ['Routine', 'Workday, Weekend and Rest day, fitted to your times'],
    ['Meals', 'South Indian example plan with swaps'],
    ['Workouts', 'Dumbbell beginner, 5 days a week'],
  ];
  return (
    <View style={styles.section}>
      <Card title="What you will get" gap={0}>
        {items.map(({ icon: Icon, title, sub }, i) => (
          <View
            key={title}
            style={[styles.item, i > 0 && { borderTopWidth: 1, borderTopColor: colors.hairline }]}
            accessible
            accessibilityLabel={`${title}. ${sub}`}
          >
            <Icon size={18} color={colors.accents.primary.text} strokeWidth={2} />
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
      </Card>
      <Card title="Your starting plan" gap={6}>
        <Text variant="caption" tone="secondary">
          An example to start from. Change anything in Routine, Food and Train.
        </Text>
        {plan.map(([k, v]) => (
          <View key={k} style={styles.summaryRow} accessible accessibilityLabel={`${k}: ${v}`}>
            <Text variant="sub" tone="secondary">
              {k}
            </Text>
            <Text variant="sub" weight={600} style={styles.summaryValue}>
              {v}
            </Text>
          </View>
        ))}
      </Card>
      <Card title="Summary" gap={6}>
        {summary.map(([k, v]) => (
          <View key={k} style={styles.summaryRow} accessible accessibilityLabel={`${k}: ${v}`}>
            <Text variant="sub" tone="secondary">
              {k}
            </Text>
            <Text variant="sub" weight={600} num style={styles.summaryValue}>
              {v}
            </Text>
          </View>
        ))}
      </Card>
    </View>
  );
}

function Frame({
  step,
  title,
  subtitle,
  onBack,
  footer,
  children,
}: {
  step: number;
  title: string;
  subtitle: string;
  onBack?: () => void;
  footer: ReactNode;
  children: ReactNode;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.flex, { backgroundColor: colors.canvas }]}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
      >
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            disabled={!onBack}
            onPress={onBack}
            style={[styles.back, !onBack && styles.dim]}
          >
            <ChevronLeft size={22} color={colors.textSecondary} strokeWidth={2} />
          </Pressable>
          <View
            style={styles.dots}
            accessible
            accessibilityLabel={`Step ${step} of ${ONBOARDING_STEPS}`}
          >
            {Array.from({ length: ONBOARDING_STEPS }, (_, i) => i + 1).map((n) => (
              <View
                key={n}
                style={[
                  styles.dot,
                  n === step && styles.dotActive,
                  {
                    backgroundColor: n <= step ? colors.buttonPrimary : colors.border,
                  },
                ]}
              />
            ))}
          </View>
          <Text variant="sub" tone="secondary" num style={styles.count}>
            {`${step}/${ONBOARDING_STEPS}`}
          </Text>
        </View>
        <View style={styles.titles}>
          <Text variant="title" accessibilityRole="header">
            {title}
          </Text>
          <Text variant="body" tone="secondary">
            {subtitle}
          </Text>
        </View>
        {children}
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
        {footer}
      </View>
    </KeyboardAvoidingView>
  );
}

function Loading() {
  const { colors } = useTheme();
  return (
    <View
      style={[styles.flex, styles.center, { backgroundColor: colors.canvas }]}
      accessibilityLabel="Loading"
    >
      <ActivityIndicator color={colors.accents.primary.base} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 16, paddingBottom: 24, gap: 16 },
  header: { flexDirection: 'row', alignItems: 'center', height: 44, marginBottom: 8 },
  back: { width: 44, height: 44, justifyContent: 'center' },
  dim: { opacity: 0.3 },
  dots: { flex: 1, flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotActive: { width: 24 },
  count: { width: 44, textAlign: 'right' },
  titles: { gap: 4, marginBottom: 4 },
  section: { gap: 16 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  summaryValue: { flexShrink: 1, textAlign: 'right' },
  footer: { paddingHorizontal: 16, paddingTop: 8, gap: 8 },
});
