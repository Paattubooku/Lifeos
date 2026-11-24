import { useRouter } from 'expo-router';
import { CircleCheck, CircleMinus, CircleX, RefreshCw } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { useNow } from '@/features/today/hooks/useNow';
import { shortDay } from '@/features/today/lib/present';
import { formatInr } from '@/lib/format';
import { Button, Card, Chip, Screen, StatusChip, Text, useTheme } from '@/ui';

import type { SkippedRow } from '../api';
import { useIntegrations } from '../hooks/useIntegrations';
import { useMoney } from '../hooks/useMoney';
import { categoryIdFor } from '../lib/ingest';
import { classifySms, type SmsResult } from '../lib/smsParser';
import { guessAmount } from '../lib/tokens';
import { AddExpenseSheet } from './AddExpenseSheet';
import { MONO } from './IntegrationsScreen';

/** The reference's 7 Parser Lab samples (My-Tracker ParserLabTab), verbatim. */
export const SAMPLES = [
  'ICICI Bank Acct XX219 debited for Rs 40.00 on 01-Jun-26; HOT N SPICY credited. UPI:651870302957. Call 18002662 for dispute. SMS BLOCK 219 to 9215676766',
  'Dear Customer, Acct XX219 is credited with Rs 16.80 on 01-Jun-26 from supermoney. UPI:615210447014-ICICI Bank.',
  'ACTFIBER bill of Rs 1237.82 for 108863157766 due on 2026-06-15, will be auto-debited on 2026-06-12-ICICI Bank.',
  'Your account is not debited with Rs 5000.00 towards AuraGold for Autopay due to cbs rejection 0116, RRN 705667557146-ICICI Bank.',
  'Rs. 2,000.00 cardless withdrawal at ICICI Bank ATM on 10-Jun-26. Info: CCW*27801HHR*14970530*6723*C. To dispute call 18002662 or SMS BLOCK 219 to 9215676766',
  'INR 1,237.82 spent using ICICI Bank Card XX8006 on 12-Jun-26 on ICICI BILL PAY. Avl Limit: INR 1,27,524.36. If not you, call 1800 2662/SMS BLOCK 8006 to 9215676766',
  'ICICI Bank Credit Card XX8006 Statement is sent to yo********@example.com. Total of Rs 1,237.82 or minimum of Rs 100.00 is due by 20-JUN-26.',
] as const;
const SAMPLE_LABELS = [
  'UPI debit',
  'UPI credit',
  'Bill reminder',
  'Failed autopay',
  'ATM',
  'Card spend',
  'Statement',
];

const REASON: Record<string, string> = {
  bill_reminder: 'Bill reminder',
  failed_autopay: 'Failed autopay',
  statement_notice: 'Statement',
  noise: 'Promo / noise',
  otp: 'OTP',
  unmatched: 'No rule matched',
};

type Step = { name: string; ok: boolean | null; detail: string };

/** Parser Lab (Integrations-ParserLab design): inbox, dry run, skipped messages. */
export function ParserLabScreen({ now: fixedNow }: { now?: number } = {}) {
  const ticking = useNow(60_000);
  const now = fixedNow ?? ticking;
  const router = useRouter();
  const { colors } = useTheme();
  const g = useIntegrations();
  const m = useMoney(now);
  const [text, setText] = useState('');
  const [result, setResult] = useState<SmsResult | null>(null);
  const [marking, setMarking] = useState<SkippedRow | null>(null);

  const run = (sms: string) => {
    setText(sms);
    setResult(sms.trim() ? classifySms(sms) : null);
  };
  const looksLikePayment = g.inbox.filter(
    (i) => classifySms(i.raw_sms).kind === 'transaction',
  ).length;
  const known =
    result?.kind === 'transaction'
      ? m.expenses.find((e) => e.txn_ref === result.txnRef)
      : undefined;
  const catName = (key: string) =>
    m.categories.find((c) => c.id === categoryIdFor(key, m.categories))?.name ?? key;

  const steps: Step[] = !result
    ? []
    : [
        {
          name: 'Reject rules',
          ok: result.kind !== 'skipped',
          detail: result.kind === 'skipped' ? `matched ${result.rule}` : 'none matched',
        },
        {
          name: 'Extract',
          ok: result.kind === 'transaction' ? true : result.kind === 'unmatched' ? false : null,
          detail:
            result.kind === 'transaction'
              ? `rule ${result.rule}`
              : result.kind === 'unmatched'
                ? 'no rule matched'
                : 'not reached',
        },
        ...(result.kind === 'transaction'
          ? [
              { name: 'Categorise', ok: true, detail: catName(result.category) },
              {
                name: 'Dedupe',
                ok: !known,
                detail: known
                  ? `already logged ${shortDay(known.date)}`
                  : `new ref …${result.txnRef.slice(-4)}`,
              },
            ]
          : []),
      ];
  const verdict = !result
    ? null
    : result.kind === 'transaction'
      ? known
        ? { label: 'Duplicate', tone: 'neutral' as const }
        : { label: 'Would save', tone: 'success' as const }
      : result.kind === 'skipped'
        ? { label: 'Would skip', tone: 'neutral' as const }
        : { label: 'Unmatched', tone: 'danger' as const };

  return (
    <Screen
      title="Parser Lab"
      subtitle="SMS → transactions, with every step shown"
      withTabBar={false}
      back={{ label: 'Integrations', onPress: () => router.back() }}
    >
      <Card testID="inbox-card">
        <View style={styles.row}>
          <View style={styles.flex}>
            <Text variant="metric" num>
              {String(g.inbox.length)}
            </Text>
            <Text variant="caption" tone="secondary">
              {`in inbox · ${looksLikePayment} look like payments`}
            </Text>
          </View>
          <Button
            icon={RefreshCw}
            label={g.processing ? 'Processing…' : 'Process now'}
            accessibilityLabel="Process the inbox now"
            disabled={g.processing}
            onPress={() => void g.processNow()}
          />
        </View>
        {g.inbox.some((i) => i.last_error) ? (
          <Text variant="caption" style={{ color: colors.accents.danger.base }}>
            {`Last error: ${g.inbox.find((i) => i.last_error)?.last_error}`}
          </Text>
        ) : null}
      </Card>

      <Card testID="dry-run">
        <Text variant="kicker" tone="secondary">
          Dry run
        </Text>
        <TextInput
          value={text}
          onChangeText={(t) => {
            setText(t);
            setResult(null);
          }}
          multiline
          placeholder="Paste a bank SMS"
          placeholderTextColor={colors.textSecondary}
          accessibilityLabel="SMS to test"
          style={[
            styles.input,
            {
              color: colors.text,
              borderColor: colors.accents.primary.base,
              backgroundColor: colors.recessed,
              fontFamily: MONO,
            },
          ]}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.chips}>
            {SAMPLES.map((s, i) => (
              <Chip
                key={i}
                label={SAMPLE_LABELS[i]!}
                accessibilityLabel={`Sample: ${SAMPLE_LABELS[i]}`}
                onPress={() => run(s)}
              />
            ))}
          </View>
        </ScrollView>
        <Button
          variant="outline"
          label="Test, don’t save"
          accessibilityLabel="Test, don’t save"
          disabled={!text.trim()}
          fullWidth
          onPress={() => run(text)}
        />
        {result && verdict ? (
          <View style={styles.gap} testID="dry-result">
            <View style={styles.row}>
              <Text variant="kicker" tone="secondary" style={styles.flex}>
                Stages
              </Text>
              <StatusChip label={verdict.label} tone={verdict.tone} />
            </View>
            {steps.map((s) => {
              const Icon = s.ok === null ? CircleMinus : s.ok ? CircleCheck : CircleX;
              const c =
                s.ok === null
                  ? colors.textSecondary
                  : s.ok
                    ? colors.accents.success.base
                    : colors.accents.danger.base;
              return (
                <View
                  key={s.name}
                  style={styles.row}
                  accessible
                  accessibilityLabel={`${s.name}: ${s.detail}`}
                >
                  <Icon size={20} color={c} />
                  <Text variant="body" weight={600} style={styles.stepName}>
                    {s.name}
                  </Text>
                  <Text variant="sub" tone="secondary" style={styles.flex}>
                    {s.detail}
                  </Text>
                </View>
              );
            })}
            {result.kind === 'transaction' ? (
              <>
                <Text variant="kicker" tone="secondary">
                  Extracted fields
                </Text>
                <View style={styles.fields}>
                  {[
                    ['Amount', formatInr(result.amount, 2)],
                    ['Type', result.direction === 'debit' ? 'Debit' : 'Credit'],
                    ['Payee', result.merchant ?? '—'],
                    ['Date', shortDay(result.date)],
                    ['Category', catName(result.category)],
                    ['Ref', `…${result.txnRef.slice(-4)}`],
                  ].map(([k, v]) => (
                    <View
                      key={k}
                      style={[styles.field, { backgroundColor: colors.recessed }]}
                      accessible
                      accessibilityLabel={`${k}: ${v}`}
                    >
                      <Text variant="kicker" tone="secondary">
                        {k!}
                      </Text>
                      <Text variant="body" weight={700}>
                        {v!}
                      </Text>
                    </View>
                  ))}
                </View>
              </>
            ) : null}
          </View>
        ) : null}
      </Card>

      <Card padding={16} gap={4} testID="skipped">
        <View style={styles.row}>
          <Text variant="kicker" tone="secondary" style={styles.flex}>
            Skipped
          </Text>
          <Text variant="caption" tone="secondary">
            {String(g.skipped.length)}
          </Text>
        </View>
        {g.skipped.length === 0 ? (
          <Text variant="sub" tone="secondary">
            Nothing skipped. Bill reminders, OTPs and promos land here.
          </Text>
        ) : (
          g.skipped.map((s, i) => (
            <View
              key={s.client_id}
              style={[
                styles.skip,
                i > 0 ? { borderTopWidth: 1, borderColor: colors.hairline } : null,
              ]}
            >
              <Text variant="sub" numberOfLines={3} style={{ fontFamily: MONO }}>
                {s.raw_sms}
              </Text>
              <View style={styles.row}>
                <View style={styles.flex}>
                  <StatusChip
                    label={`${REASON[s.classification ?? 'unmatched'] ?? s.classification} · ${shortDay(s.received_at.slice(0, 10))}`}
                    tone={s.classification === 'unmatched' ? 'danger' : 'neutral'}
                  />
                </View>
                <Button
                  size="sm"
                  variant="outline"
                  label="Mark as expense"
                  accessibilityLabel={`Mark as expense: ${s.raw_sms.slice(0, 40)}`}
                  onPress={() => setMarking(s)}
                />
              </View>
            </View>
          ))
        )}
      </Card>

      {marking ? (
        <AddExpenseSheet
          title="Mark as expense"
          today={m.today}
          categories={m.categories}
          incomeId={m.incomeId}
          initialCategoryId={null}
          initial={{ amount: guessAmount(marking.raw_sms), note: 'From skipped SMS' }}
          onClose={() => setMarking(null)}
          onSave={(e) => {
            const s = marking;
            setMarking(null);
            g.markAsExpense(s, e);
          }}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  flex: { flex: 1 },
  gap: { gap: 10 },
  chips: { flexDirection: 'row', gap: 8 },
  input: {
    minHeight: 96,
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  stepName: { width: 100 },
  fields: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  field: { width: '48%', borderRadius: 10, padding: 10, gap: 2 },
  skip: { paddingVertical: 10, gap: 8 },
});
