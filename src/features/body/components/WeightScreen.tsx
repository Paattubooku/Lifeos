import { useRouter } from 'expo-router';
import { BarChart3, Plus, Soup } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useFood } from '@/features/food/hooks/useFood';
import { applyChanges } from '@/features/routine/slice';
import { useNow } from '@/features/today/hooks/useNow';
import { dayMonth, shortDay } from '@/features/today/lib/present';
import { nowDayMinutes } from '@/features/today/lib/timeline';
import { formatIndianNumber } from '@/lib/format';
import { useAppDispatch } from '@/store';
import { Button, Card, SegmentedToggle, Screen, StatTile, Text, useSnackbar, useTheme } from '@/ui';

import { useBody } from '../hooks/useBody';
import { MEASURED_MIN } from '../lib/energy';
import { inRange, planWeighIn } from '../lib/weight';
import { EnergyCard } from './EnergyCard';
import { WeighInSheet } from './WeighInSheet';
import { WeightChart } from './WeightChart';

const RANGES = [
  { value: '4W', label: '4W' },
  { value: '12W', label: '12W' },
  { value: 'All', label: 'All' },
] as const;

/** Energy card shows after dinner is logged or from 21:00 (PRD F13). */
export const ENERGY_FROM_MIN = 21 * 60;

const signed = (v: number | null) =>
  v === null ? '—' : v > 0 ? `+${v}` : v === 0 ? '0.0' : `−${Math.abs(v)}`;

/** `/weight` (Prog-Weight / Prog-WeightNoData / Prog-Energy designs). */
export function WeightScreen({ now: fixedNow }: { now?: number } = {}) {
  const ticking = useNow(60_000);
  const now = fixedNow ?? ticking;
  const router = useRouter();
  const dispatch = useAppDispatch();
  const showSnackbar = useSnackbar();
  const { colors } = useTheme();
  const body = useBody(now);
  const food = useFood(now);
  const [range, setRange] = useState<'4W' | '12W' | 'All'>('12W');
  const [weighing, setWeighing] = useState(false);

  const dinner = food.day.meals.find((m) => m.meal.slot === 'dinner');
  const showEnergy =
    nowDayMinutes(now) >= ENERGY_FROM_MIN ||
    dinner?.status === 'eaten' ||
    dinner?.status === 'partly';
  const s = body.stats;
  const latest = body.points.at(-1);
  const trend = body.trend;

  const save = (kg: number, salty: boolean) => {
    setWeighing(false);
    const before = body.todayRow && !body.todayRow.deleted_at ? body.todayRow : null;
    const w = planWeighIn(body.today, kg, salty, body.todayRow);
    void dispatch(applyChanges([{ op: 'upsert', ...w }])).then(() =>
      showSnackbar({
        message: `${kg.toFixed(1)} kg saved`,
        actionLabel: 'Undo',
        onAction: () =>
          void dispatch(
            applyChanges(
              before
                ? [
                    {
                      op: 'upsert',
                      table: 'weight_log',
                      clientId: before.client_id,
                      row: { weight_kg: before.weight_kg, note: before.note },
                    },
                  ]
                : body.todayRow
                  ? [
                      {
                        op: 'upsert',
                        table: 'weight_log',
                        clientId: body.todayRow.client_id,
                        row: { deleted_at: new Date().toISOString() },
                      },
                    ]
                  : [],
            ),
          ),
      }),
    );
  };

  return (
    <Screen
      title="Weight"
      subtitle={
        latest ? `Last weigh-in ${latest.weight} kg · ${shortDay(latest.date)}` : 'No weigh-ins yet'
      }
      withTabBar={false}
      back={{ label: 'Back', onPress: () => router.back() }}
      action={
        <Button
          icon={Plus}
          size="sm"
          label="Weigh in"
          accessibilityLabel="Weigh in"
          onPress={() => setWeighing(true)}
        />
      }
    >
      <View style={styles.tiles}>
        <StatTile
          label="7-day avg"
          accent="primary"
          value={s.avg7 === null ? '—' : s.avg7.toFixed(1)}
          sub="kg"
          style={styles.flex}
        />
        <StatTile
          label="Vs last week"
          accent="success"
          value={signed(s.change7)}
          sub="kg"
          style={styles.flex}
        />
        <StatTile
          label="Total"
          accent="success"
          value={signed(s.totalLost)}
          sub={s.since ? `kg since ${dayMonth(s.since)}` : 'kg'}
          style={styles.flex}
        />
      </View>

      <Card kicker="Weight · kg" testID="weight-card">
        <SegmentedToggle
          accessibilityLabel="Range"
          options={RANGES}
          value={range}
          onChange={setRange}
        />
        {body.points.length > 0 ? (
          <WeightChart
            points={inRange(body.points, body.today, range)}
            today={body.today}
            goal={body.goal}
            trend={
              trend.status === 'ok' && latest
                ? { perDay: trend.kgPerWeek / 7, from: latest.avg7 }
                : null
            }
          />
        ) : (
          <Text variant="sub" tone="secondary">
            Log your first weigh-in to start the chart.
          </Text>
        )}
      </Card>

      <Card kicker={`Projection to ${body.goal} kg`} testID="projection">
        {trend.status === 'not_enough' ? (
          <Text variant="body" testID="not-enough">
            {`Not enough data. ${14 - trend.points} more weigh-in${14 - trend.points === 1 ? '' : 's'} in the last 4 weeks and the projection appears.`}
          </Text>
        ) : (
          <>
            <View style={styles.row}>
              <BarChart3 size={18} color={colors.accents.primary.base} strokeWidth={2} />
              <View style={styles.flex}>
                <Text variant="body" weight={700}>
                  {trend.status === 'flat'
                    ? 'Trend is flat or rising'
                    : trend.reached
                      ? `Trend: at ${body.goal} kg`
                      : `Trend: ${body.goal} kg by ${shortDay(trend.date)}`}
                </Text>
                <Text
                  variant="caption"
                  tone="secondary"
                >{`Last 4 weeks of 7-day averages: ${trend.kgPerWeek > 0 ? '+' : ''}${trend.kgPerWeek} kg/week`}</Text>
              </View>
            </View>
            <View style={styles.row}>
              <Soup size={18} color={colors.accents.calories.base} strokeWidth={2} />
              <View style={styles.flex}>
                <Text variant="body" weight={700}>
                  {body.intakeProj.status === 'ok'
                    ? `Intake-based: ${shortDay(body.intakeProj.date)}`
                    : body.intakeProj.status === 'flat'
                      ? 'Intake-based: no deficit logged'
                      : 'Intake-based: log food on 7+ days'}
                </Text>
                <Text variant="caption" tone="secondary">
                  {body.intakeProj.status === 'ok'
                    ? `Logged deficit ${body.intakeProj.deficit} kcal/day ≈ ${body.intakeProj.kgPerWeek} kg/week`
                    : body.intakeProj.status === 'flat'
                      ? `Eating ${-body.intakeProj.deficit} kcal/day above the ${formatIndianNumber(body.tdeeKcal)} kcal TDEE`
                      : `${body.intakeProj.days} logged days in the last 2 weeks`}
                </Text>
              </View>
            </View>
          </>
        )}
      </Card>

      {showEnergy ? (
        <EnergyCard
          tdeeKcal={body.tdeeKcal}
          eaten={body.eatenToday}
          bmrKcal={body.bmrKcal}
          weightForBmr={body.weightForBmr}
          factor={body.factor}
          measured={body.eligible}
        />
      ) : (
        <Card kicker="Energy · today">
          <Text variant="sub" tone="secondary">
            Today’s deficit shows once dinner is logged, or from 9 pm.
          </Text>
        </Card>
      )}

      <Card kicker="Check against the scale" testID="measured">
        <Text variant="body">
          {body.eligible && body.measured !== null
            ? `Measured from your 4-week trend, real TDEE is about ${formatIndianNumber(body.measured)} kcal (${body.measured >= body.estimated ? '+' : '−'}${formatIndianNumber(Math.abs(body.measured - body.estimated))} vs the estimate). The energy card uses it now.`
            : `After 4 weeks with ${MEASURED_MIN.weighIns}+ weigh-ins and ${MEASURED_MIN.foodDays}+ food-logged days, the app measures your real TDEE from the scale and switches to it. So far: ${body.recentCounts.weighIns} weigh-ins, ${body.recentCounts.foodDays} food days.`}
        </Text>
      </Card>

      {weighing ? (
        <WeighInSheet
          today={body.today}
          points={body.points}
          initialKg={
            body.todayRow && !body.todayRow.deleted_at
              ? Number(body.todayRow.weight_kg)
              : (latest?.weight ?? Number(body.profile?.start_weight_kg ?? 80))
          }
          initialSalty={body.todayRow?.note === 'salty'}
          onSave={save}
          onClose={() => setWeighing(false)}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  tiles: { flexDirection: 'row', gap: 8 },
  flex: { flex: 1, minWidth: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
