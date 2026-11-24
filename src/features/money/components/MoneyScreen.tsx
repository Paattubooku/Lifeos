import { useRouter } from 'expo-router';
import { BarChart3, ListChecks, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useNow } from '@/features/today/hooks/useNow';
import { dayMonth, shortDay } from '@/features/today/lib/present';
import { formatInr } from '@/lib/format';
import {
  Button,
  Card,
  EmptyState,
  MenuRow,
  ProgressBar,
  Screen,
  StatTile,
  Text,
  useTheme,
} from '@/ui';

import { useMoney } from '../hooks/useMoney';
import { useMoneyActions } from '../hooks/useMoneyActions';
import { analytics, monthOffset } from '../lib/analytics';
import {
  budgetAlerts,
  categoryBudgets,
  dailySpend,
  monthView,
  vsLastMonthPct,
} from '../lib/budget';
import { AddExpenseSheet } from './AddExpenseSheet';
import { ExpenseItem } from './ExpenseItem';
import { categoryColor } from './look';
import { SpendBars } from './SpendBars';

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
export const monthName = (date: string) => MONTHS[Number(date.slice(5, 7)) - 1]!;

/** More → Money (Money-Overview design, PRD F18). */
export function MoneyScreen({ now: fixedNow }: { now?: number } = {}) {
  const ticking = useNow(60_000);
  const now = fixedNow ?? ticking;
  const router = useRouter();
  const { colors } = useTheme();
  const m = useMoney(now);
  const actions = useMoneyActions();
  const [adding, setAdding] = useState(false);

  const v = monthView(m.expenses, m.today, m.budget);
  const vs = vsLastMonthPct(v);
  const prevMonth = monthName(monthOffset(m.today, -1));
  const bars = dailySpend(m.expenses, m.today, 14);
  const barsTotal = bars.reduce((s, b) => s + b.total, 0);
  const cats = categoryBudgets(m.expenses, m.categories, m.today, m.otherId);
  const alerts = budgetAlerts(cats);
  const top = analytics(m.expenses, 'month', m.today, {
    order: m.categories.map((c) => c.id),
    fallback: m.otherId ?? '',
  }).categories[0];
  const color = (id: string | null) =>
    categoryColor(id ? m.byId.get(id) : null, m.categories, colors);
  const over = v.left < 0;

  return (
    <Screen
      title="Money"
      subtitle={`${shortDay(m.today)} · cash + UPI + card`}
      withTabBar={false}
      back={{ label: 'More', onPress: () => router.back() }}
      action={
        <Button
          icon={Plus}
          size="sm"
          label="Add"
          accessibilityLabel="Add expense"
          onPress={() => setAdding(true)}
        />
      }
    >
      <Card testID="month-card">
        <View style={styles.head}>
          <Text variant="kicker" tone="secondary" style={styles.flex}>
            {monthName(m.today)}
          </Text>
          {vs !== null && vs !== 0 ? (
            <View
              style={[
                styles.badge,
                {
                  backgroundColor:
                    vs < 0 ? colors.accents.success.tint : colors.accents.danger.tint,
                },
              ]}
            >
              <Text
                variant="caption"
                weight={700}
                style={{ color: vs < 0 ? colors.accents.success.base : colors.accents.danger.base }}
              >
                {`${Math.abs(vs)}% ${vs < 0 ? 'lower' : 'higher'} than ${prevMonth}`.toUpperCase()}
              </Text>
            </View>
          ) : null}
        </View>
        <Text variant="hero" num>
          {formatInr(v.spent)}
          <Text variant="sub" tone="secondary">{` of ${formatInr(v.budget)}`}</Text>
        </Text>
        <ProgressBar
          progress={v.budget > 0 ? v.spent / v.budget : 0}
          pace={v.pace}
          accent={over ? 'danger' : 'primary'}
          accessibilityLabel={`${formatInr(v.spent)} of ${formatInr(v.budget)} spent; even pace today ${formatInr(v.paceAmount)}`}
        />
        <View style={styles.head}>
          <Text variant="caption" tone="secondary" style={styles.flex}>
            {`${v.budget > 0 ? Math.round((v.spent / v.budget) * 100) : 0}% spent · day ${v.day} of ${v.days}`}
          </Text>
          <Text
            variant="caption"
            weight={600}
            style={over ? { color: colors.accents.danger.base } : null}
            tone={over ? undefined : 'secondary'}
          >
            {over
              ? `Over by ${formatInr(-v.left)}`
              : `${formatInr(v.left)} left · ${formatInr(v.perDay)}/day`}
          </Text>
        </View>
        <Text variant="caption" tone="secondary">
          {`${v.sameDaysLastMonth > 0 ? `Same days in ${prevMonth}: ${formatInr(v.sameDaysLastMonth)}. ` : ''}Tick = even pace for today (${formatInr(v.paceAmount)}).`}
        </Text>
      </Card>

      <View style={styles.tiles}>
        <StatTile
          label="Today"
          accent="primary"
          value={formatInr(v.todaySpend)}
          sub={`${v.todayCount} ${v.todayCount === 1 ? 'payment' : 'payments'}`}
          style={styles.flex}
        />
        <StatTile
          label="Income"
          accent="success"
          value={formatInr(v.income)}
          sub={`${monthName(m.today).slice(0, 3)} so far`}
          style={styles.flex}
        />
      </View>

      <Card testID="bars-card">
        <View style={styles.head}>
          <Text variant="kicker" tone="secondary" style={styles.flex}>
            Last 14 days
          </Text>
          <Text variant="caption" tone="secondary">
            {`${formatInr(barsTotal)} · ${dayMonth(bars[0]!.date)}–${dayMonth(m.today)}`}
          </Text>
        </View>
        <SpendBars bars={bars} />
      </Card>

      <Card padding={16} gap={4} testID="last5">
        <View style={styles.head}>
          <Text variant="kicker" tone="secondary" style={styles.flex}>
            Last 5
          </Text>
          <Button
            size="sm"
            variant="secondary"
            label="All"
            accessibilityLabel="All transactions"
            onPress={() => router.push('/money/transactions')}
          />
        </View>
        {m.expenses.length === 0 ? (
          <EmptyState
            icon={Plus}
            title="No expenses yet"
            body="Add one in three taps: amount, category, save."
            action={{
              label: 'Add expense',
              accessibilityLabel: 'Add your first expense',
              onPress: () => setAdding(true),
            }}
          />
        ) : (
          m.expenses
            .slice(0, 5)
            .map((e, i) => (
              <ExpenseItem
                key={e.client_id}
                expense={e}
                category={e.category_id ? m.byId.get(e.category_id) : undefined}
                color={color(e.category_id)}
                today={m.today}
                divider={i > 0}
                onDelete={() => actions.remove(e)}
              />
            ))
        )}
      </Card>

      <Card padding={14} gap={0}>
        <MenuRow
          icon={BarChart3}
          title="Analytics"
          sub={
            top
              ? `${m.byId.get(top.category)?.name ?? 'Other'} ${Math.round(top.percentage)}% of spend`
              : 'Categories, weekdays, top payees'
          }
          onPress={() => router.push('/money/analytics')}
          divider
        />
        <MenuRow
          icon={ListChecks}
          accent="calories"
          title="Budgets"
          sub={
            alerts.length
              ? alerts
                  .slice(0, 2)
                  .map((a) =>
                    a.tone === 'red' && a.left < 0
                      ? `${a.category.name} over by ${formatInr(-a.left)}`
                      : `${a.category.name} at ${a.pct}%`,
                  )
                  .join(' · ')
              : `${cats.length} categories within budget`
          }
          onPress={() => router.push('/money/budgets')}
        />
      </Card>

      {adding ? (
        <AddExpenseSheet
          today={m.today}
          categories={m.categories}
          incomeId={m.incomeId}
          initialCategoryId={null}
          onClose={() => setAdding(false)}
          onSave={(e, name) => {
            setAdding(false);
            actions.add(e, name);
          }}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  tiles: { flexDirection: 'row', gap: 10 },
  flex: { flex: 1 },
});
