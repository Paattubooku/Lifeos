import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import {
  Bell,
  Cable,
  Clock,
  Compass,
  Droplet,
  Dumbbell,
  IndianRupee,
  ListTodo,
  Palette,
  Settings,
  Soup,
} from 'lucide-react-native';
import { Platform } from 'react-native';

import { selectUser } from '@/features/auth/selectors';
import { useIntegrations } from '@/features/money/hooks/useIntegrations';
import { useMoney } from '@/features/money/hooks/useMoney';
import { monthView } from '@/features/money/lib/budget';
import { ProfileCard } from '@/features/profile/components/ProfileCard';
import { useProfile } from '@/features/profile/hooks/useProfileData';
import { useRoutine } from '@/features/routine/hooks/useRoutine';
import { blocksSummary } from '@/features/routine/lib/blocks';
import { SyncStatusCard } from '@/features/sync/components/SyncStatusCard';
import { selectSyncSummary } from '@/features/sync/selectors';
import { queueUpsert, retryDead, runSync } from '@/features/sync/slice';
import { useTasks } from '@/features/tasks/hooks/useTasks';
import { isOverdue } from '@/features/tasks/lib/tasks';
import { useNow } from '@/features/today/hooks/useNow';
import { shortDay } from '@/features/today/lib/present';
import { todayLogical } from '@/lib/dates';
import { formatInr } from '@/lib/format';
import { startupMs } from '@/lib/startup';
import { useAppDispatch, useAppSelector } from '@/store';
import { Button, Card, MenuRow, Screen, Text } from '@/ui';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** More tab (More-Menu design, PRD F23). */
export function MoreScreen({ now: fixedNow }: { now?: number } = {}) {
  const ticking = useNow(60_000);
  const now = fixedNow ?? ticking;
  const dispatch = useAppDispatch();
  const router = useRouter();
  const user = useAppSelector(selectUser);
  const sync = useAppSelector(selectSyncSummary);
  const { profile } = useProfile();
  const { todayPlan } = useRoutine();
  const tasks = useTasks(now);
  const money = useMoney(now);
  const integ = useIntegrations();
  const month = monthView(money.expenses, money.today, money.budget);
  const overdue = tasks.pending.filter((t) => isOverdue(t, tasks.today)).length;
  const active = integ.tokens.filter((t) => !t.revoked_at).length;
  const version = Constants.expoConfig?.version ?? '';
  const start = startupMs();

  return (
    <Screen title="More" kicker={shortDay(money.today)}>
      <ProfileCard
        email={user?.email ?? null}
        startWeightKg={profile?.start_weight_kg ?? null}
        goalWeightKg={profile?.goal_weight_kg ?? null}
        onboardedAt={profile?.onboarded_at ?? null}
        onPress={() => router.push('/settings/profile')}
      />
      <Card padding={14} gap={0}>
        <MenuRow
          icon={ListTodo}
          accent="primary"
          title="Tasks"
          sub={`${tasks.pending.length + tasks.top3.filter((t) => t.status === 'open').length} pending${overdue ? ` · ${overdue} overdue` : ''}`}
          onPress={() => router.push('/tasks')}
          divider
        />
        <MenuRow
          icon={IndianRupee}
          accent="success"
          title="Money"
          sub={`${MONTHS[Number(money.today.slice(5, 7)) - 1]}: ${formatInr(month.spent)} of ${formatInr(month.budget)}`}
          onPress={() => router.push('/money')}
          divider
        />
        <MenuRow
          icon={Clock}
          title="Routine"
          sub={
            todayPlan.template
              ? `${todayPlan.template.name} · ${blocksSummary(todayPlan.blocks).split(' · ')[0]}`
              : 'Templates for your day'
          }
          onPress={() => router.push('/routine')}
        />
      </Card>
      <Card padding={14} gap={0}>
        <MenuRow
          icon={Soup}
          accent="calories"
          title="Meal plan"
          sub="Dishes, swaps and default meals"
          onPress={() => router.push('/meal-plan')}
          divider
        />
        <MenuRow
          icon={Dumbbell}
          accent="protein"
          title="Program"
          sub="Days, sets, reps and rest · tap a day to edit"
          onPress={() => router.push('/program')}
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
          sub={`SMS parser · ${integ.inbox.length} in inbox · ${active} ${active === 1 ? 'token' : 'tokens'}`}
          onPress={() => router.push('/settings/integrations')}
          divider
        />
        <MenuRow
          icon={Compass}
          title="App tour"
          sub="What every screen does, in a minute"
          onPress={() => router.push('/tour')}
          divider
        />
        <MenuRow
          icon={Settings}
          title="Settings"
          sub="Profile, targets, theme, Screen Time, export"
          onPress={() => router.push('/settings')}
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
      <Text variant="caption" tone="secondary" align="center">
        {`LifeOS ${version} · ${Platform.OS === 'ios' ? 'iPhone' : 'Android'}${start !== null ? ` · opened Today in ${(start / 1000).toFixed(1)} s` : ''}`}
      </Text>
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
          <Button
            variant="secondary"
            icon={Palette}
            label="Open component gallery"
            accessibilityLabel="Open component gallery"
            onPress={() => router.push('/dev/gallery')}
          />
        </Card>
      ) : null}
    </Screen>
  );
}
