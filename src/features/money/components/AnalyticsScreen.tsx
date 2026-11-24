import { useRouter } from 'expo-router';
import { ChartColumn } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useNow } from '@/features/today/hooks/useNow';
import { dayMonth, shortDay } from '@/features/today/lib/present';
import { formatInr } from '@/lib/format';
import { Card, EmptyState, SegmentedToggle, Screen, StatTile, Text, useTheme } from '@/ui';

import { useMoney } from '../hooks/useMoney';
import {
  analytics,
  type AnalyticsRange,
  monthOffset,
  RANGE_LABELS,
  rangeStart,
  weekdayAverages,
} from '../lib/analytics';
import { CategoryTile, categoryColor } from './look';
import { monthName } from './MoneyScreen';
import { Bars } from './SpendBars';

const RANGE_OPTIONS = [
  { value: '7d', label: '7D' },
  { value: '30d', label: '30D' },
  { value: '90d', label: '90D' },
  { value: 'month', label: 'Month' },
  { value: 'all', label: 'All' },
] as const;
const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** Money-Analytics design + PRD F18 (port of the reference analytics). */
export function AnalyticsScreen({ now: fixedNow }: { now?: number } = {}) {
  const ticking = useNow(60_000);
  const now = fixedNow ?? ticking;
  const router = useRouter();
  const { colors, scheme } = useTheme();
  const m = useMoney(now);
  const [range, setRange] = useState<AnalyticsRange>('month');
  const a = analytics(m.expenses, range, m.today, {
    order: m.categories.map((c) => c.id),
    fallback: m.otherId ?? '',
  });
  const first = m.expenses.at(-1)?.date ?? m.today;
  const start = rangeStart(range, m.today) ?? first;
  const week = weekdayAverages(a.weekdayPattern, start, m.today);
  const weekendSpend = (week[5]?.total ?? 0) + (week[6]?.total ?? 0);
  const weekendDays = (week[5]?.days ?? 0) + (week[6]?.days ?? 0);
  const allDays = week.reduce((s, w) => s + w.days, 0);
  const series = scheme === 'dark' ? colors.accents.primary.light : colors.buttonPrimary;
  const mc = a.monthComparison;
  const subtitle =
    range === 'month'
      ? `${monthName(m.today)} · ${formatInr(a.totalDebit)} spent`
      : `${RANGE_LABELS[range]} · ${formatInr(a.totalDebit)} spent`;

  return (
    <Screen
      title="Analytics"
      subtitle={subtitle}
      withTabBar={false}
      back={{ label: 'Money', onPress: () => router.back() }}
    >
      <SegmentedToggle
        accessibilityLabel="Range"
        options={RANGE_OPTIONS}
        value={range}
        onChange={setRange}
      />

      <View style={styles.tiles}>
        <StatTile
          label="Spent"
          accent="primary"
          value={formatInr(a.totalDebit)}
          sub={`${a.txnCount} payments`}
          style={styles.flex}
        />
        <StatTile
          label="Avg payment"
          accent="primary"
          value={formatInr(Math.round(a.avgTransaction))}
          sub="per debit"
          style={styles.flex}
        />
        <StatTile
          label="Received"
          accent="success"
          value={formatInr(a.totalCredit)}
          sub="income"
          style={styles.flex}
        />
      </View>
      {mc.changePct !== null ? (
        <Text variant="caption" tone="secondary" testID="mom">
          {`${monthName(m.today)} so far is ${Math.abs(Math.round(mc.changePct))}% ${mc.changePct >= 0 ? 'higher' : 'lower'} than all of ${monthName(monthOffset(m.today, -1))} (${formatInr(mc.previousMonthTotal)}).`}
        </Text>
      ) : null}

      {a.txnCount === 0 ? (
        <Card>
          <EmptyState
            icon={ChartColumn}
            title="No spend in this range"
            body="Pick a longer range or add an expense."
          />
        </Card>
      ) : (
        <>
          <Card padding={16} gap={4} testID="by-category">
            <View style={styles.head}>
              <Text variant="kicker" tone="secondary" style={styles.flex}>
                By category
              </Text>
              <Text variant="caption" tone="secondary">
                share of spend
              </Text>
            </View>
            {a.categories.map((c, i) => {
              const cat = m.byId.get(c.category);
              const color = categoryColor(cat, m.categories, colors);
              const name = cat?.name ?? 'Other';
              return (
                <Pressable
                  key={c.category}
                  onPress={() =>
                    router.push({
                      pathname: '/money/transactions',
                      params: { category: c.category },
                    })
                  }
                  accessibilityRole="button"
                  accessibilityLabel={`${name}: ${formatInr(c.total)}, ${Math.round(c.percentage)}% of spend. Show transactions`}
                  style={[
                    styles.catRow,
                    i > 0 ? { borderTopWidth: 1, borderColor: colors.hairline } : null,
                  ]}
                >
                  <View style={styles.head}>
                    <View style={[styles.dot, { backgroundColor: color }]} />
                    <Text variant="body" weight={600} style={styles.flex}>
                      {name}
                    </Text>
                    <Text variant="sub" tone="secondary" num>
                      {formatInr(c.total)}
                    </Text>
                    <Text variant="body" weight={700} num style={styles.pct}>
                      {`${Math.round(c.percentage)}%`}
                    </Text>
                  </View>
                  <View style={[styles.track, { backgroundColor: colors.recessed }]}>
                    <View
                      style={[
                        styles.fill,
                        { width: `${Math.max(c.percentage, 1)}%`, backgroundColor: color },
                      ]}
                    />
                  </View>
                </Pressable>
              );
            })}
          </Card>

          <Card testID="daily-trend">
            <View style={styles.head}>
              <Text variant="kicker" tone="secondary" style={styles.flex}>
                Daily spend
              </Text>
              <Text variant="caption" tone="secondary">
                {`${dayMonth(a.dailyTrend[0]!.date)}–${dayMonth(m.today)}${a.dailyTrend.length === 90 && range === 'all' ? ' · last 90 days' : ''}`}
              </Text>
            </View>
            <Bars
              bars={a.dailyTrend.map((d) => ({
                label: '',
                value: d.debit,
                detail: shortDay(d.date),
              }))}
              color={series}
              height={110}
              accessibilityLabel={`Spend per day over ${a.dailyTrend.length} days`}
            />
          </Card>

          <Card testID="weekday">
            <View style={styles.head}>
              <Text variant="kicker" tone="secondary" style={styles.flex}>
                Day of week
              </Text>
              <Text variant="caption" tone="secondary">
                avg per day
              </Text>
            </View>
            <Bars
              bars={week.map((w, i) => ({
                label: DAY_LETTERS[i]!,
                value: w.avg,
                detail: `${w.label}: ${formatInr(w.total)} over ${w.days} days, average`,
              }))}
              color={series}
              valueLabels
              emphasis={(i) => {
                const max = Math.max(...week.map((w) => w.avg));
                return week[i]!.avg === max || i >= 5;
              }}
              accessibilityLabel={`Average spend by weekday: ${week.map((w) => `${w.label} ${formatInr(w.avg)}`).join(', ')}`}
            />
            {a.totalDebit > 0 && allDays > 0 ? (
              <Text variant="sub" tone="secondary">
                {`Weekends are ${Math.round((weekendSpend / a.totalDebit) * 100)}% of spend on ${Math.round((weekendDays / allDays) * 100)}% of days.`}
              </Text>
            ) : null}
          </Card>

          <Card padding={16} gap={2} testID="payees">
            <Text variant="kicker" tone="secondary">
              {`Top ${a.topPayees.length} payees`}
            </Text>
            {a.topPayees.map((p, i) => {
              const last = m.expenses.find(
                (e) => (e.merchant?.trim() || 'Unknown') === p.payee && e.direction === 'debit',
              );
              const cat = last?.category_id ? m.byId.get(last.category_id) : undefined;
              return (
                <View
                  key={p.payee}
                  accessible
                  accessibilityLabel={`${i + 1}. ${p.payee}, ${formatInr(p.total)}, ${p.count} ${p.count === 1 ? 'payment' : 'payments'}`}
                  style={[
                    styles.payee,
                    i > 0 ? { borderTopWidth: 1, borderColor: colors.hairline } : null,
                  ]}
                >
                  <Text variant="sub" tone="secondary" style={styles.rank}>
                    {String(i + 1)}
                  </Text>
                  <CategoryTile
                    icon={cat?.icon}
                    color={categoryColor(cat, m.categories, colors)}
                    size={32}
                  />
                  <View style={styles.flex}>
                    <Text variant="body" weight={600}>
                      {p.payee}
                    </Text>
                    <Text variant="caption" tone="secondary">
                      {`${p.count} ${p.count === 1 ? 'payment' : 'payments'}`}
                    </Text>
                  </View>
                  <Text variant="body" weight={700} num>
                    {formatInr(p.total)}
                  </Text>
                </View>
              );
            })}
          </Card>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  tiles: { flexDirection: 'row', gap: 10 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flex: { flex: 1 },
  catRow: { paddingVertical: 10, gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  pct: { width: 44, textAlign: 'right' },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
  payee: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  rank: { width: 16 },
});
