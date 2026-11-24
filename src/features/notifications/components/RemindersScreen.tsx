import { useRouter } from 'expo-router';
import {
  LifeBuoy,
  NotebookPen,
  RotateCcw,
  ScanSearch,
  TriangleAlert,
  Bell,
  Droplet,
  Dumbbell,
  type LucideIcon,
  Moon,
  Scale,
  Smartphone,
  Soup,
} from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { useFood } from '@/features/food/hooks/useFood';
import { useReminderPermission } from '@/features/profile/hooks/useReminderPermission';
import { hhmm } from '@/features/routine/lib/blocks';
import { useNow } from '@/features/today/hooks/useNow';
import { useToday } from '@/features/today/hooks/useToday';
import { useWater } from '@/features/water/hooks/useWater';
import { addDays } from '@/lib/dates';
import { formatClock } from '@/lib/format';
import { useAppDispatch, useAppSelector } from '@/store';
import { type Accent, Banner, Card, ProgressBar, Screen, Text, Toggle, useTheme } from '@/ui';

import { useReminderSchedule } from '../hooks/useReminderSchedule';
import { countFor, DAILY_CAP, type ReminderType } from '../schedule';
import { quietToday, reminderToggled } from '../slice';

/** More → Reminders (Reminders design): quiet today, today's count vs the cap, a switch per type. */
export function RemindersScreen({ now: fixedNow }: { now?: number } = {}) {
  const ticking = useNow(60_000);
  const now = fixedNow ?? ticking;
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { colors } = useTheme();
  const t = useToday(now);
  const food = useFood(now);
  const water = useWater(now);
  const reminders = useReminderSchedule({ t, food, water });
  const enabled = useAppSelector((s) => s.notifications.enabled);
  const quietDate = useAppSelector((s) => s.notifications.quietDate);
  const { permission, enable } = useReminderPermission();
  const quiet = quietDate === t.today;
  const today = countFor(reminders, t.today);
  const wake = formatClock(hhmm(t.profile?.wake_time ?? '05:00'));
  const workout = t.plan.blocks.find((b) => b.kind === 'workout');

  const rows: {
    type: ReminderType;
    icon: LucideIcon;
    accent: Accent;
    title: string;
    sub: string;
  }[] = [
    {
      type: 'block',
      icon: Bell,
      accent: 'primary',
      title: 'Block start',
      sub: 'Wake, pack lunch, lights out…',
    },
    {
      type: 'water',
      icon: Droplet,
      accent: 'water',
      title: 'Water pace',
      sub: 'Only when 300 ml+ behind',
    },
    {
      type: 'workout',
      icon: Dumbbell,
      accent: 'protein',
      title: 'Workout in 5 min',
      sub: workout
        ? `${formatClock(addMinutes(hhmm(workout.start_time), -5))} on training days`
        : 'On training days',
    },
    {
      type: 'meals',
      icon: Soup,
      accent: 'calories',
      title: 'Meals',
      sub: 'Skipped once the meal is logged',
    },
    {
      type: 'phone_off',
      icon: Smartphone,
      accent: 'danger',
      title: `Phone away · ${formatClock(hhmm(t.profile?.phone_off_time ?? '21:30'))}`,
      sub: 'Includes today’s score',
    },
    {
      type: 'weigh_in',
      icon: Scale,
      accent: 'primary',
      title: `Weigh-in · ${formatClock(addMinutes(hhmm(t.profile?.wake_time ?? '05:00'), 15))}`,
      sub: t.profile?.weigh_in_mode === 'weekly' ? 'Weekly' : 'Daily',
    },
    {
      type: 'review',
      icon: NotebookPen,
      accent: 'primary',
      title: 'Weekly review · Sun 8:00 pm',
      sub: 'Skipped once the week is reviewed',
    },
    {
      type: 'interrupt',
      icon: TriangleAlert,
      accent: 'danger',
      title: 'Failure interrupt',
      sub: '3+ blocks overdue: one thing now · max 3 a day',
    },
    {
      type: 'missed_day',
      icon: RotateCcw,
      accent: 'primary',
      title: 'Missed-day recovery',
      sub: 'After a bad day: pick one non-negotiable',
    },
    {
      type: 'fallback',
      icon: LifeBuoy,
      accent: 'calories',
      title: 'Fallback mode',
      sub: 'After 6 pm under 50%: 4 rescue actions',
    },
    {
      type: 'reality',
      icon: ScanSearch,
      accent: 'success',
      title: 'Reality check',
      sub: 'When the scale and the logs disagree · weekly at most',
    },
  ];

  return (
    <Screen
      title="Reminders"
      subtitle={`Blunt, short, max ${DAILY_CAP} a day`}
      withTabBar={false}
      back={{ label: 'More', onPress: () => router.back() }}
    >
      {permission && !permission.granted ? (
        <Banner
          tone="warning"
          title="Reminders off — enable"
          body="Notifications are off for LifeOS, so nothing below will ring."
          action={{
            label: 'Enable',
            accessibilityLabel: 'Enable reminders',
            onPress: () => void enable(),
          }}
          testID="reminders-off"
        />
      ) : null}

      <Card>
        <View style={styles.row}>
          <View style={[styles.icon, { backgroundColor: colors.recessed }]}>
            <Moon size={18} color={colors.text} strokeWidth={2} />
          </View>
          <View style={styles.flex}>
            <Toggle
              label="Quiet today"
              hint={`Mutes everything until ${wake} tomorrow.`}
              value={quiet}
              onChange={(on) => dispatch(quietToday(on ? t.today : null))}
              testID="toggle-quiet"
            />
          </View>
        </View>
      </Card>

      <Card testID="reminder-count">
        <View style={styles.between}>
          <Text variant="body" weight={700}>{`Today: ${today} of ${DAILY_CAP} scheduled`}</Text>
          <Text variant="sub" tone="secondary">{`${DAILY_CAP - today} spare`}</Text>
        </View>
        <ProgressBar
          progress={today / DAILY_CAP}
          accent="primary"
          accessibilityLabel={`${today} of ${DAILY_CAP} reminders today`}
        />
        <Text variant="caption" tone="secondary">
          {`Hard cap of ${DAILY_CAP} a day. Past that, the lowest-priority ones (water checks first) are dropped so the important ones still get read. Tomorrow: ${countFor(reminders, addDays(t.today, 1))}.`}
        </Text>
      </Card>

      <Card padding={14} gap={0}>
        {rows.map((r, i) => (
          <View
            key={r.type}
            style={[
              styles.row,
              i < rows.length - 1 ? { borderBottomWidth: 1, borderColor: colors.hairline } : null,
            ]}
          >
            <View style={[styles.icon, { backgroundColor: colors.accents[r.accent].tint }]}>
              <r.icon size={18} color={colors.accents[r.accent].base} strokeWidth={2} />
            </View>
            <View style={styles.flex}>
              <Toggle
                label={r.title}
                hint={r.sub}
                value={enabled[r.type] !== false}
                onChange={(on) => dispatch(reminderToggled({ type: r.type, on }))}
                testID={`toggle-${r.type}`}
              />
            </View>
          </View>
        ))}
      </Card>
      <Text variant="caption" tone="secondary">
        Nudges are blunt on purpose. Switch any of them off here.
      </Text>
    </Screen>
  );
}

function addMinutes(t: string, by: number): string {
  const m = (((Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5)) + by) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  icon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
});
