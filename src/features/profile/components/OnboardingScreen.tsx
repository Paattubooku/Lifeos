import { useRouter } from 'expo-router';
import { ChevronLeft, Clock, Droplet, Smartphone } from 'lucide-react-native';
import { type ReactNode, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Sex } from '@/features/body/lib/energy';
import { templateForDate, templateLabel } from '@/features/routine/lib/templates';
import { formatClock, formatIndianNumber } from '@/lib/format';
import { enableReminders } from '@/lib/notifications';
import { useAppDispatch, useAppSelector } from '@/store';
import { Button, Card, Text, useTheme } from '@/ui';

import { useProfileContext } from '../hooks/useProfileData';
import { fieldsFromProfile, planOnboarding } from '../lib/plan';
import { checkDay, type ProfileFields } from '../lib/targets';
import { applyWrites, draftCleared, draftStarted, draftUpdated } from '../slice';
import { BodyFields, DayFields, TargetsFields } from './ProfileFields';

export const ONBOARDING_STEPS = 4;

const TITLES: Record<number, { title: string; subtitle: string }> = {
  1: { title: 'Body', subtitle: 'Used for calorie and protein targets. Only you see this.' },
  2: { title: 'Day', subtitle: 'Every block on Today hangs off these three times.' },
  3: { title: 'Targets', subtitle: 'Prefilled. Change anything now or later in More.' },
  // PRD F15 caps reminders at 10/day (the design's "8" is mock copy).
  4: { title: 'Notifications', subtitle: 'Max 10 a day. You can mute any of them.' },
};

export function clampStep(raw: string | string[] | undefined): number {
  const n = Number(Array.isArray(raw) ? raw[0] : raw);
  return Number.isInteger(n) && n >= 1 && n <= ONBOARDING_STEPS ? n : 1;
}

/** Onboarding 1…4 (design/screens/Onboarding-*.png). */
export function OnboardingScreen({ step }: { step: number }) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const ctx = useProfileContext();
  const draft = useAppSelector((s) => s.profile.draft);
  const [finishing, setFinishing] = useState(false);

  // Seed the form from the profile (defaults from seed_defaults) on first entry.
  useEffect(() => {
    // Not while finishing: the draft is cleared before this screen unmounts.
    if (!draft && ctx.profile && !finishing)
      dispatch(draftStarted(fieldsFromProfile(ctx.profile, ctx.latestWeightKg)));
  }, [ctx.profile, ctx.latestWeightKg, dispatch, draft, finishing]);

  if (!draft || !ctx.profile) return <Loading />;

  const profile = ctx.profile;
  const update = (patch: Partial<ProfileFields>) => dispatch(draftUpdated(patch));
  const person = {
    sex: (profile.sex === 'female' ? 'female' : 'male') as Sex,
    birthYear: profile.birth_year,
    activityFactor: Number(profile.activity_factor),
  };
  const dayError = checkDay(draft).error;

  const next = () =>
    router.push({ pathname: '/onboarding/[step]', params: { step: String(step + 1) } });

  const finish = async (allowNotifications: boolean) => {
    setFinishing(true);
    if (allowNotifications) await enableReminders();
    const writes = planOnboarding(profile, draft, {
      now: new Date(),
      today: ctx.today,
      blocks: ctx.blocks,
      templates: ctx.templates,
      todayDayLog: ctx.todayDayLog,
      todayWeight: ctx.todayWeight,
      program: ctx.program,
    });
    await dispatch(applyWrites(writes));
    dispatch(draftCleared());
    router.replace('/today');
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
          <Button
            size="lg"
            fullWidth
            label="Continue"
            accessibilityLabel="Continue"
            disabled={step === 2 && dayError !== null}
            onPress={next}
          />
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
      {step === 1 ? <BodyFields value={draft} onChange={update} today={ctx.today} /> : null}
      {step === 2 ? <DayFields value={draft} onChange={update} /> : null}
      {step === 3 ? (
        <TargetsFields value={draft} onChange={update} today={ctx.today} person={person} />
      ) : null}
      {step === 4 ? (
        <NotificationsStep
          fields={draft}
          template={(() => {
            const t = templateForDate(ctx.templates, ctx.today);
            return t ? templateLabel(t) : '—';
          })()}
        />
      ) : null}
    </Frame>
  );
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
    <View style={[styles.flex, { backgroundColor: colors.canvas }]}>
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
    </View>
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
