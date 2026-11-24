import { useRouter } from 'expo-router';
import {
  Bell,
  Cable,
  Clock,
  Droplet,
  ListTodo,
  LogOut,
  Wallet,
  MoonStar,
  Palette,
  Scale,
  Soup,
} from 'lucide-react-native';

import { selectUser } from '@/features/auth/selectors';
import { signOut } from '@/features/auth/slice';
import { ProfileCard } from '@/features/profile/components/ProfileCard';
import { useProfile } from '@/features/profile/hooks/useProfileData';
import { useRoutine } from '@/features/routine/hooks/useRoutine';
import { blocksSummary } from '@/features/routine/lib/blocks';
import { SyncStatusCard } from '@/features/sync/components/SyncStatusCard';
import { selectSyncSummary } from '@/features/sync/selectors';
import { queueUpsert, retryDead, runSync } from '@/features/sync/slice';
import { todayLogical } from '@/lib/dates';
import { useAppDispatch, useAppSelector } from '@/store';
import { setThemePreference } from '@/store/appSlice';
import { Button, Card, MenuRow, SegmentedToggle, Screen, Text, type ThemePreference } from '@/ui';

const THEME_OPTIONS = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
] as const satisfies readonly { value: ThemePreference; label: string }[];

export default function MoreScreen() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const preference = useAppSelector((s) => s.app.themePreference);
  const user = useAppSelector(selectUser);
  const offline = useAppSelector((s) => s.auth.offline);
  const sync = useAppSelector(selectSyncSummary);
  const { profile } = useProfile();
  const { todayPlan } = useRoutine();

  return (
    <Screen title="More" subtitle="Tasks, money and settings arrive in later features.">
      <ProfileCard
        email={user?.email ?? null}
        startWeightKg={profile?.start_weight_kg ?? null}
        goalWeightKg={profile?.goal_weight_kg ?? null}
        onboardedAt={profile?.onboarded_at ?? null}
        onPress={() => router.push('/settings/profile')}
      />
      <Card padding={14} gap={0}>
        <MenuRow
          icon={Clock}
          title="Routine"
          sub={
            todayPlan.template
              ? `${todayPlan.template.name} · ${blocksSummary(todayPlan.blocks).split(' · ')[0]}`
              : 'Templates for your day'
          }
          onPress={() => router.push('/routine')}
          divider
        />
        <MenuRow
          icon={ListTodo}
          accent="danger"
          title="Tasks"
          sub="Today’s top 3 and everything pending"
          onPress={() => router.push('/tasks')}
          divider
        />
        <MenuRow
          icon={Wallet}
          accent="success"
          title="Money"
          sub="Expenses, budgets and analytics"
          onPress={() => router.push('/money')}
          divider
        />
        <MenuRow
          icon={Droplet}
          accent="water"
          title="Water"
          sub="Today’s log, pace and 7-day stats"
          onPress={() => router.push('/water')}
          divider
        />
        <MenuRow
          icon={Scale}
          accent="primary"
          title="Weight"
          sub="Weigh-in, trend, projection, energy"
          onPress={() => router.push('/weight')}
        />
      </Card>
      <Card padding={14} gap={0}>
        <MenuRow
          icon={Soup}
          accent="calories"
          title="Meal plan"
          sub="Dishes, swaps and default meals"
          onPress={() => router.push('/meal-plan')}
        />
      </Card>
      <Card padding={14} gap={0}>
        <MenuRow
          icon={Bell}
          accent="danger"
          title="Reminders"
          sub="Max 10 a day · quiet today"
          onPress={() => router.push('/settings/reminders')}
          divider
        />
        <MenuRow
          icon={Cable}
          title="Integrations"
          sub="Bank SMS import, Siri and Shortcuts tokens"
          onPress={() => router.push('/settings/integrations')}
          divider
        />
        <MenuRow
          icon={MoonStar}
          title="Screen Time setup"
          sub="Downtime / Bedtime mode, step by step"
          onPress={() => router.push('/settings/screen-time')}
        />
      </Card>
      <Card kicker="Appearance" title="Theme">
        <SegmentedToggle
          accessibilityLabel="Theme"
          options={THEME_OPTIONS}
          value={preference}
          onChange={(v) => dispatch(setThemePreference(v))}
        />
        <Text variant="sub" tone="secondary">
          Default is Dark. System follows your phone.
        </Text>
      </Card>
      <Card kicker="Account" title={user?.email ?? 'Signed in'}>
        <Text variant="sub" tone="secondary">
          {offline
            ? 'Offline — signed in from this phone’s saved session.'
            : 'Synced to your account only.'}
        </Text>
        <Button
          variant="secondary"
          icon={LogOut}
          label="Sign out"
          accessibilityLabel="Sign out"
          onPress={() => void dispatch(signOut())}
        />
      </Card>
      <SyncStatusCard
        summary={sync}
        onSync={() => void dispatch(runSync())}
        onRetry={() => {
          dispatch(retryDead({ now: Date.now() }));
          void dispatch(runSync());
        }}
      />
      {__DEV__ ? (
        <Card kicker="Developer" title="Sync test">
          <Text variant="sub" tone="secondary">
            Queues a real 200 ml water entry for today (F02 check: try it in airplane mode, kill the
            app, reopen, reconnect).
          </Text>
          <Button
            variant="water"
            icon={Droplet}
            label="Queue 200 ml water"
            accessibilityLabel="Queue a 200 millilitre test water entry"
            onPress={() =>
              void dispatch(
                queueUpsert({
                  table: 'water_log',
                  row: {
                    date: todayLogical(),
                    amount_ml: 200,
                    logged_at: new Date().toISOString(),
                  },
                }),
              )
            }
          />
        </Card>
      ) : null}
      {__DEV__ ? (
        <Card kicker="Developer" title="Component gallery">
          <Text variant="sub" tone="secondary">
            Every src/ui component, to compare against design/screens/Components-*.png.
          </Text>
          <Button
            variant="secondary"
            icon={Palette}
            label="Open gallery"
            accessibilityLabel="Open component gallery"
            onPress={() => router.push('/dev/gallery')}
          />
        </Card>
      ) : null}
    </Screen>
  );
}
