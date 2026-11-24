import { Check, Delete } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { addDays, type DateString } from '@/lib/dates';
import { formatInr, formatIndianNumber } from '@/lib/format';
import { Button, Chip, SegmentedToggle, Sheet, Text, TextField, Toggle, useTheme } from '@/ui';

import type { ExpenseCategoryRow } from '../api';
import {
  keypadInput,
  type NewExpense,
  parseAmount,
  PAYMENT_METHODS,
  type PaymentMethod,
} from '../lib/expense';
import { iconFor } from './look';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'back'] as const;

/** "1,240.5" while typing (keeps the trailing dot / zeros the user typed). */
function shown(text: string): string {
  if (text === '') return '0';
  const [int = '0', frac] = text.split('.');
  return `${formatIndianNumber(Number(int))}${frac !== undefined ? `.${frac}` : ''}`;
}

/** Money-AddExpense design: amount → category → save in three taps. */
export function AddExpenseSheet({
  today,
  categories,
  incomeId,
  initialCategoryId,
  onSave,
  onClose,
}: {
  today: DateString;
  categories: readonly ExpenseCategoryRow[];
  incomeId: string | null;
  initialCategoryId: string | null;
  onSave: (e: NewExpense, categoryName: string | null) => void;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const { height } = useWindowDimensions();
  const [text, setText] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(initialCategoryId);
  const [method, setMethod] = useState<PaymentMethod>('upi');
  const [merchant, setMerchant] = useState('');
  const [note, setNote] = useState('');
  const [recurring, setRecurring] = useState(false);
  const [date, setDate] = useState<DateString>(today);
  const amount = parseAmount(text);
  const income = categoryId !== null && categoryId === incomeId;
  const category = categories.find((c) => c.id === categoryId) ?? null;

  const save = () => {
    if (amount === null) return;
    onSave(
      {
        amount,
        date,
        direction: income ? 'credit' : 'debit',
        categoryId,
        method,
        merchant,
        note,
        recurring,
      },
      category?.name ?? null,
    );
  };

  return (
    <Sheet
      visible
      onClose={onClose}
      title={income ? 'Add income' : 'Add expense'}
      accessory={
        <Text variant="caption" tone="secondary">
          3 taps: amount → category → save
        </Text>
      }
      testID="add-expense-sheet"
    >
      <ScrollView
        style={{ maxHeight: height * 0.78 }}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text
          variant="hero"
          num
          align="center"
          accessibilityLabel={`Amount ${amount === null ? 'empty' : formatInr(amount)}`}
          testID="amount"
        >
          {`₹${shown(text)}`}
        </Text>

        <View style={styles.chips}>
          {categories.map((c) => (
            <Chip
              key={c.id}
              label={c.name}
              leadingIcon={iconFor(c.icon)}
              selected={c.id === categoryId}
              accessibilityLabel={`Category ${c.name}`}
              onPress={() => setCategoryId(c.id === categoryId ? null : c.id)}
            />
          ))}
        </View>

        <View style={styles.row}>
          <View style={styles.flex}>
            <SegmentedToggle
              accessibilityLabel="Payment method"
              options={PAYMENT_METHODS}
              value={method}
              onChange={setMethod}
            />
          </View>
        </View>
        <View style={styles.row}>
          <View style={styles.flex}>
            <TextField
              label={income ? 'From' : 'Payee'}
              value={merchant}
              onChangeText={setMerchant}
              placeholder={income ? 'Who paid' : 'Murugan Stores'}
              maxLength={80}
            />
          </View>
          <View style={styles.flex}>
            <TextField
              label="Note"
              value={note}
              onChangeText={setNote}
              placeholder="Optional"
              maxLength={200}
            />
          </View>
        </View>
        <View style={styles.row}>
          <Chip
            label="Today"
            selected={date === today}
            accessibilityLabel="Date today"
            onPress={() => setDate(today)}
          />
          <Chip
            label="Yesterday"
            selected={date === addDays(today, -1)}
            accessibilityLabel="Date yesterday"
            onPress={() => setDate(addDays(today, -1))}
          />
          <View style={styles.flex}>
            <Toggle label="Recurring" value={recurring} onChange={setRecurring} />
          </View>
        </View>

        <View style={styles.pad}>
          {KEYS.map((k) => (
            <Pressable
              key={k}
              accessibilityRole="button"
              accessibilityLabel={k === 'back' ? 'Delete digit' : k === '.' ? 'Decimal point' : k}
              onPress={() => setText((t) => keypadInput(t, k))}
              onLongPress={k === 'back' ? () => setText('') : undefined}
              style={({ pressed }) => [
                styles.key,
                { backgroundColor: pressed ? colors.hairline : colors.recessed },
              ]}
            >
              {k === 'back' ? (
                <Delete size={22} color={colors.text} strokeWidth={2} />
              ) : (
                <Text variant="heading" num>
                  {k}
                </Text>
              )}
            </Pressable>
          ))}
        </View>

        <Button
          icon={Check}
          fullWidth
          disabled={amount === null}
          label={
            amount === null
              ? 'Enter an amount'
              : `Save ${formatInr(amount, amount % 1 ? 2 : 0)}${category ? ` · ${category.name}` : ''}`
          }
          accessibilityLabel={
            amount === null
              ? 'Enter an amount'
              : `Save ${formatInr(amount, amount % 1 ? 2 : 0)}${category ? `, ${category.name}` : ''}`
          }
          onPress={save}
          testID="save-expense"
        />
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  content: { gap: 12, paddingBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flex: { flex: 1 },
  pad: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  key: {
    width: '31.5%',
    height: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
