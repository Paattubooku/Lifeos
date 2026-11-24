import { useRouter } from 'expo-router';
import { BellOff, BellRing, X } from 'lucide-react-native';
import { type ReactNode, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useAppDispatch } from '@/store';
import { Banner, Button, Card, Screen, Text, useSnackbar, useTheme } from '@/ui';

import { useProfileContext } from '../hooks/useProfileData';
import { useReminderPermission } from '../hooks/useReminderPermission';
import { fieldsFromProfile, planProfileSave } from '../lib/plan';
import { checkDay, type ProfileFields } from '../lib/targets';
import { applyWrites } from '../slice';
import { EXAMPLE } from '../lib/onboarding';
import { AboutFields, BodyFields, DayFields, TargetsFields } from './ProfileFields';

/** Settings → Profile & targets (PRD F03: edits the onboarding fields later). */
export function ProfileSettingsScreen() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const showSnackbar = useSnackbar();
  const { colors } = useTheme();
  const ctx = useProfileContext();
  const { permission, enable } = useReminderPermission();
  const [edits, setEdits] = useState<Partial<ProfileFields>>({});
  const [saving, setSaving] = useState(false);

  const initial = useMemo(
    () => (ctx.profile ? fieldsFromProfile(ctx.profile, ctx.latestWeightKg) : null),
    [ctx.profile, ctx.latestWeightKg],
  );
  const form = useMemo(() => (initial ? { ...initial, ...edits } : null), [initial, edits]);

  const writes = useMemo(
    () =>
      form && ctx.profile
        ? planProfileSave(ctx.profile, form, {
            blocks: ctx.blocks,
            today: ctx.today,
            todayWeight: ctx.todayWeight,
            latestWeightKg: ctx.latestWeightKg,
          })
        : [],
    [form, ctx.profile, ctx.blocks, ctx.today, ctx.todayWeight, ctx.latestWeightKg],
  );

  const close = (
    <Button
      size="sm"
      variant="outline"
      icon={X}
      label="Close"
      accessibilityLabel="Close profile settings"
      onPress={() => router.back()}
    />
  );

  if (!form || !ctx.profile) {
    return (
      <Screen title="Profile" withTabBar={false} accessory={close}>
        <ActivityIndicator color={colors.accents.primary.base} accessibilityLabel="Loading" />
      </Screen>
    );
  }

  const update = (patch: Partial<ProfileFields>) => setEdits((e) => ({ ...e, ...patch }));
  const dayError = checkDay(form).error;

  const save = async () => {
    setSaving(true);
    await dispatch(applyWrites(writes));
    setSaving(false);
    showSnackbar({ message: 'Profile saved' });
    router.back();
  };

  return (
    <Screen
      title="Profile"
      subtitle="Body, day and targets. Changes apply from now on."
      withTabBar={false}
      accessory={close}
    >
      <Card kicker="Reminders" gap={8}>
        {permission?.granted ? (
          <View style={styles.row} accessible accessibilityLabel="Reminders on">
            <BellRing size={18} color={colors.accents.success.text} strokeWidth={2} />
            <Text variant="sub">Reminders on</Text>
          </View>
        ) : (
          <Banner
            tone="warning"
            icon={BellOff}
            title="Reminders off — enable"
            body={
              permission && !permission.canAskAgain
                ? 'Turn notifications on for LifeOS in your phone’s Settings.'
                : 'Block starts, water pace and phone-away nudges. Max 10 a day.'
            }
            action={{
              label: 'Enable',
              accessibilityLabel: 'Enable reminders',
              onPress: () => void enable(),
            }}
            testID="reminders-off"
          />
        )}
      </Card>

      <Section title="About you">
        <AboutFields
          value={form}
          onChange={({ birth_year, height_cm: _h, ...rest }) =>
            // A blank or out-of-range year keeps the saved one.
            update(birth_year === null || birth_year === undefined ? rest : { ...rest, birth_year })
          }
          example={EXAMPLE}
          showHeight={false}
        />
      </Section>
      <Section title="Body">
        <BodyFields value={form} onChange={update} today={ctx.today} />
      </Section>
      <Section title="Day">
        <Text variant="sub" tone="secondary">
          Changing wake time moves only the Wake block; other blocks keep their times.
        </Text>
        <DayFields value={form} onChange={update} />
      </Section>
      <Section title="Targets">
        <TargetsFields value={form} onChange={update} today={ctx.today} />
      </Section>

      <Button
        size="lg"
        fullWidth
        label={saving ? 'Saving…' : writes.length === 0 ? 'No changes' : 'Save'}
        accessibilityLabel="Save profile"
        disabled={saving || writes.length === 0 || dayError !== null}
        onPress={() => void save()}
      />
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text variant="heading" accessibilityRole="header">
        {title}
      </Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
