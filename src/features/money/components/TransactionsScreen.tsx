import { useRouter } from 'expo-router';
import { Search } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { useNow } from '@/features/today/hooks/useNow';
import { shortDay } from '@/features/today/lib/present';
import { formatInr } from '@/lib/format';
import {
  Button,
  Card,
  Chip,
  EmptyState,
  SegmentedToggle,
  Screen,
  Text,
  TextField,
  useTheme,
} from '@/ui';

import { useMoney } from '../hooks/useMoney';
import { useMoneyActions } from '../hooks/useMoneyActions';
import {
  byDay,
  filterExpenses,
  type Filters,
  hasFilters,
  NO_FILTERS,
  PAGE_SIZE,
  type TypeFilter,
} from '../lib/expense';
import { ExpenseItem } from './ExpenseItem';
import { categoryColor, iconFor } from './look';
import { monthName } from './MoneyScreen';

const TYPES = [
  { value: 'all', label: 'All' },
  { value: 'debit', label: 'Spent' },
  { value: 'credit', label: 'Received' },
] as const;

/** Money-Transactions design; `category` pre-filters (Analytics drill-down, AC3). */
export function TransactionsScreen({
  now: fixedNow,
  category,
}: { now?: number; category?: string } = {}) {
  const ticking = useNow(60_000);
  const now = fixedNow ?? ticking;
  const router = useRouter();
  const { colors } = useTheme();
  const m = useMoney(now);
  const actions = useMoneyActions();
  const [filters, setFilters] = useState<Filters>({
    ...NO_FILTERS,
    ...(category ? { category, type: 'debit' as TypeFilter } : {}),
  });
  const [pages, setPages] = useState(1);
  const set = (f: Partial<Filters>) => {
    setFilters((x) => ({ ...x, ...f }));
    setPages(1);
  };

  const shown = filterExpenses(m.expenses, filters);
  const page = shown.slice(0, pages * PAGE_SIZE);
  const month = m.expenses.filter((e) => e.date.slice(0, 7) === m.today.slice(0, 7));
  const fromSms = month.filter((e) => e.source === 'sms').length;

  return (
    <Screen
      title="Transactions"
      subtitle={`${monthName(m.today)} · ${month.length} ${month.length === 1 ? 'entry' : 'entries'}${fromSms ? ` · ${fromSms} from SMS` : ''}`}
      withTabBar={false}
      back={{ label: 'Money', onPress: () => router.back() }}
    >
      <SegmentedToggle
        accessibilityLabel="Show"
        options={TYPES}
        value={filters.type}
        onChange={(type) => set({ type })}
      />
      <TextField
        label="Search"
        icon={Search}
        value={filters.search}
        onChangeText={(search) => set({ search })}
        placeholder="Search payee, note, amount"
        returnKeyType="search"
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} testID="category-chips">
        <View style={styles.chips}>
          <Chip
            label="All"
            selected={filters.category === 'all'}
            accessibilityLabel="All categories"
            onPress={() => set({ category: 'all' })}
          />
          {m.categories.map((c) => (
            <Chip
              key={c.id}
              label={c.name}
              leadingIcon={iconFor(c.icon)}
              selected={filters.category === c.id}
              accessibilityLabel={`Only ${c.name}`}
              onPress={() => set({ category: filters.category === c.id ? 'all' : c.id })}
            />
          ))}
        </View>
      </ScrollView>

      <Card padding={16} gap={2} testID="transactions">
        {page.length === 0 ? (
          <EmptyState
            icon={Search}
            title={hasFilters(filters) ? 'Nothing matches' : 'No transactions yet'}
            body={
              hasFilters(filters)
                ? 'Try another filter or search.'
                : 'Expenses you add show up here.'
            }
            action={
              hasFilters(filters)
                ? {
                    label: 'Clear filters',
                    accessibilityLabel: 'Clear filters',
                    onPress: () => set(NO_FILTERS),
                  }
                : undefined
            }
          />
        ) : (
          byDay(page).map((g) => (
            <View key={g.date} testID={`day-${g.date}`}>
              <Text variant="kicker" tone="secondary" style={styles.dayHead}>
                {`${g.date === m.today ? 'Today' : shortDay(g.date)}${g.spent > 0 ? ` · ${formatInr(g.spent)}` : ''}`}
              </Text>
              {g.rows.map((e, i) => (
                <ExpenseItem
                  key={e.client_id}
                  expense={e}
                  category={e.category_id ? m.byId.get(e.category_id) : undefined}
                  color={categoryColor(
                    e.category_id ? m.byId.get(e.category_id) : null,
                    m.categories,
                    colors,
                  )}
                  today={m.today}
                  divider={i > 0}
                  onDelete={() => actions.remove(e)}
                />
              ))}
            </View>
          ))
        )}
      </Card>
      {shown.length > page.length ? (
        <Button
          variant="secondary"
          label={`Show ${Math.min(PAGE_SIZE, shown.length - page.length)} more`}
          accessibilityLabel={`Show more transactions, ${shown.length - page.length} left`}
          onPress={() => setPages((p) => p + 1)}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', gap: 8 },
  dayHead: { marginTop: 10, marginBottom: 2 },
});
