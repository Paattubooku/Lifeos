import { useRouter } from 'expo-router';
import { ChevronRight, Download, LogOut, Smartphone } from 'lucide-react-native';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { selectUser } from '@/features/auth/selectors';
import { signOut } from '@/features/auth/slice';
import { useProfile } from '@/features/profile/hooks/useProfileData';
import { hhmm } from '@/features/routine/lib/blocks';
import { formatClock, formatIndianNumber } from '@/lib/format';
import { useAppDispatch, useAppSelector } from '@/store';
import { setThemePreference } from '@/store/appSlice';
import { Button, Card, SegmentedToggle, Screen, Text, type ThemePreference, useTheme } from '@/ui';

import { useExport } from '../hooks/useExport';

const THEME_OPTIONS = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
] as const satisfies readonly { value: ThemePreference; label: string }[];

/** More → Settings (Settings design, PRD F23). */
export function SettingsScreen() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { colors } = useTheme();
  const user = useAppSelector(selectUser);
  const preference = useAppSelector((s) => s.app.themePreference);
  const { profile: p } = useProfile();
  const ex = useExport();
  const clock = (t: string | null | undefined, d: string) => formatClock(hhmm(t ?? d));
  const rows: [string, string][] = p
    ? [
        ['Height', p.height_cm ? `${p.height_cm} cm` : '—'],
        [
          'Weight goal',
          `${Number(p.start_weight_kg ?? 0).toFixed(1)} → ${Number(p.goal_weight_kg ?? 0).toFixed(1)} kg`,
        ],
        ['Calories', `${formatIndianNumber(p.kcal_target)} kcal`],
        ['Protein', `${p.protein_target_g} g`],
        ['Water', `${formatIndianNumber(p.water_target_ml)} ml`],
        ['Coffee limit', `${p.coffee_limit} / day`],
        ['Steps minimum', formatIndianNumber(p.steps_min)],
        ['Monthly budget', `₹${formatIndianNumber(p.monthly_budget_inr)}`],
        ['Wake · sleep', `${clock(p.wake_time, '05:00')} · ${clock(p.sleep_time, '22:00')}`],
      ]
    : [];
  const phoneAway = clock(p?.phone_off_time, '21:30');
  const wake = clock(p?.wake_time, '05:00');

  return (
    <Screen
      title="Settings"
      subtitle={user?.email ?? undefined}
      withTabBar={false}
      back={{ label: 'More', onPress: () => router.back() }}
    >
      <Card kicker="Profile & targets" padding={16} gap={0} testID="targets">
        {rows.map(([label, value], i) => (
          <Pressable
            key={label}
            onPress={() => router.push('/settings/profile')}
            accessibilityRole="button"
            accessibilityLabel={`${label}: ${value}. Edit`}
            style={[styles.row, i > 0 ? { borderTopWidth: 1, borderColor: colors.hairline } : null]}
          >
            <Text variant="body" style={styles.flex}>
              {label}
            </Text>
            <Text variant="body" tone="secondary" num>
              {value}
            </Text>
            <ChevronRight size={16} color={colors.textSecondary} />
          </Pressable>
        ))}
      </Card>

      <Card kicker="Theme">
        <SegmentedToggle
          accessibilityLabel="Theme"
          options={THEME_OPTIONS}
          value={preference}
          onChange={(v) => dispatch(setThemePreference(v))}
        />
      </Card>

      <Card testID="screen-time">
        <View style={styles.head}>
          <View style={[styles.icon, { backgroundColor: colors.accents.danger.tint }]}>
            <Smartphone size={18} color={colors.accents.danger.base} />
          </View>
          <View style={styles.flex}>
            <Text variant="body" weight={700}>
              Screen Time · stop doomscrolling
            </Text>
            <Text variant="caption" tone="secondary">{`Downtime ${phoneAway} – ${wake}`}</Text>
          </View>
        </View>
        {[
          'Settings → Screen Time → turn on, set a passcode someone else knows.',
          `Downtime → Scheduled → ${phoneAway} – ${wake}, every day. Block at Downtime: on.`,
          'Always Allowed → Phone, Messages, LifeOS (Expo Go), Clock. Nothing else.',
          `LifeOS reminds you to put the phone away at ${phoneAway}.`,
        ].map((s, i) => (
          <View key={i} style={styles.step}>
            <Text variant="sub" weight={700} style={styles.num}>
              {String(i + 1)}
            </Text>
            <Text variant="sub" style={styles.flex}>
              {s}
            </Text>
          </View>
        ))}
        <View style={styles.head}>
          <Button
            size="sm"
            variant="secondary"
            label="Open iPhone Settings"
            accessibilityLabel="Open iPhone Settings"
            onPress={() => void Linking.openSettings()}
            style={styles.flex}
          />
          <Button
            size="sm"
            variant="ghost"
            label="Full guide"
            accessibilityLabel="Screen Time full guide"
            onPress={() => router.push('/settings/screen-time')}
          />
        </View>
      </Card>

      <Card kicker="Your data" testID="your-data">
        <Text variant="sub" tone="secondary">
          {ex.last
            ? `Last export: ${formatIndianNumber(ex.last.rows)} rows, ${ex.last.size}.`
            : 'Everything you logged: days, blocks, food, sets, weight, sleep, steps, tasks, money. JSON is one file; CSV is a zip with one file per table.'}
        </Text>
        <View style={styles.head}>
          <Button
            icon={Download}
            variant="secondary"
            label={ex.busy === 'json' ? 'Exporting…' : 'Export JSON'}
            accessibilityLabel="Export JSON"
            disabled={ex.busy !== null}
            onPress={() => void ex.exportJson()}
            style={styles.flex}
          />
          <Button
            icon={Download}
            variant="secondary"
            label={ex.busy === 'csv' ? 'Exporting…' : 'Export CSV'}
            accessibilityLabel="Export CSV"
            disabled={ex.busy !== null}
            onPress={() => void ex.exportCsv()}
            style={styles.flex}
          />
        </View>
      </Card>

      <Button
        icon={LogOut}
        variant="destructive"
        label="Sign out"
        accessibilityLabel="Sign out"
        fullWidth
        onPress={() => void dispatch(signOut())}
      />
      <Text variant="caption" tone="secondary" align="center">
        Signing out keeps unsynced changes on this phone until you sign back in.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48 },
  flex: { flex: 1 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  step: { flexDirection: 'row', gap: 8 },
  num: { width: 16 },
});
