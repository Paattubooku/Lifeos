import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { useProfile } from '@/features/profile/hooks/useProfileData';
import { hhmm } from '@/features/routine/lib/blocks';
import { formatClock } from '@/lib/format';
import { Card, Screen, Text } from '@/ui';

function Steps({ steps }: { steps: readonly string[] }) {
  return (
    <View style={styles.steps}>
      {steps.map((s, i) => (
        <View key={s} style={styles.step}>
          <Text variant="sub" weight={700} style={styles.num}>{`${i + 1}.`}</Text>
          <Text variant="sub" style={styles.flex}>
            {s}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** PRD F14: step-by-step text only; Life can't change these settings itself. */
export function ScreenTimeScreen() {
  const router = useRouter();
  const { profile } = useProfile();
  const from = formatClock(hhmm(profile?.phone_off_time ?? '21:30'));
  const to = formatClock(hhmm(profile?.wake_time ?? '05:00'));
  return (
    <Screen
      title="Screen Time setup"
      subtitle={`Lock distracting apps ${from} → ${to}`}
      withTabBar={false}
      back={{ label: 'Back', onPress: () => router.back() }}
    >
      <Text variant="sub" tone="secondary">
        Set this up once on the phone. Life only reminds you; the phone does the locking.
      </Text>
      <Card kicker="iPhone" title="Downtime" testID="ios-steps">
        <Steps
          steps={[
            'Open Settings → Screen Time.',
            'Turn on App & Website Activity if asked.',
            'Tap Downtime → Scheduled, and turn it on.',
            `Choose Every Day, From ${from}, To ${to}.`,
            'Turn on Block at Downtime.',
            'Back in Screen Time → Always Allowed: keep Phone, Messages and Clock. Remove the rest.',
          ]}
        />
      </Card>
      <Card kicker="Android" title="Bedtime mode" testID="android-steps">
        <Steps
          steps={[
            'Open Settings → Digital Wellbeing & parental controls.',
            'Tap Bedtime mode (on some phones: Wind Down).',
            `Choose Use a schedule, Every day, ${from} to ${to}.`,
            'Turn on Grayscale and Do Not Disturb under Customise.',
            'Optional: App timers for the apps you lose time on.',
          ]}
        />
      </Card>
      <Card kicker="Then">
        <Text variant="sub">
          {`Charge the phone outside the bedroom. Tick “Phone away” on Today at ${from}; the Sleep screen counts those nights.`}
        </Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  steps: { gap: 8 },
  step: { flexDirection: 'row', gap: 8 },
  num: { width: 20 },
  flex: { flex: 1 },
});
