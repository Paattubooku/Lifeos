import { ChevronRight } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { daysBetween, logicalDate, todayLogical } from '@/lib/dates';
import { Card, Text, useTheme } from '@/ui';

export type ProfileCardProps = {
  email: string | null;
  startWeightKg: number | null;
  goalWeightKg: number | null;
  onboardedAt: string | null;
  onPress: () => void;
  now?: number;
};

/** "91.0 → 75 kg · day 1 · single account" (More-Menu design). */
export function profileLine(p: Omit<ProfileCardProps, 'email' | 'onPress'>): string {
  const parts: string[] = [];
  if (p.startWeightKg && p.goalWeightKg) {
    parts.push(`${p.startWeightKg.toFixed(1)} → ${Math.round(p.goalWeightKg * 10) / 10} kg`);
  }
  if (p.onboardedAt) {
    parts.push(`day ${daysBetween(logicalDate(p.onboardedAt), todayLogical(p.now)) + 1}`);
  }
  parts.push('single account');
  return parts.join(' · ');
}

export function ProfileCard(props: ProfileCardProps) {
  const { colors } = useTheme();
  const name = props.email?.split('@')[0] ?? 'You';
  const line = profileLine(props);
  return (
    <Card
      onPress={props.onPress}
      accessibilityLabel={`${name}. ${line}. Edit profile`}
      padding={14}
    >
      <View style={styles.row}>
        <View style={[styles.avatar, { backgroundColor: colors.buttonPrimary }]}>
          <Text variant="heading" tone="onButton">
            {name.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.flex}>
          <Text variant="body" weight={700} numberOfLines={1}>
            {name}
          </Text>
          <Text variant="caption" tone="secondary" num numberOfLines={1}>
            {line}
          </Text>
        </View>
        <ChevronRight size={18} color={colors.textSecondary} strokeWidth={2} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: { flex: 1, minWidth: 0, gap: 2 },
});
