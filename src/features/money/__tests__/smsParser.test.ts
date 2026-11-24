import {
  classifySms,
  EXTRACT_RULES,
  inferCategory,
  parseBankDate,
  REJECT_RULES,
  stableHash,
  syntheticRef,
} from '../lib/smsParser';
import reference from './fixtures/sms-reference.json';

type Ref = {
  classification: 'actual_debit' | 'actual_credit' | 'not_a_transaction';
  amount?: number;
  payee?: string | null;
  txn_date?: string;
  upi_ref?: string;
  reason?: string;
  meta: { stage: string; ruleName: string | null };
};

describe('F19 AC1: every reference sample classifies as the reference does', () => {
  // The reference's output was produced by running its own classifyMessage on these messages.
  it.each((reference as { sms: string; ref: Ref }[]).map((r, i) => [i, r.sms, r.ref] as const))(
    'sample %i',
    (_i, sms, ref) => {
      const r = classifySms(sms);
      if (ref.classification === 'not_a_transaction') {
        if (ref.meta.stage === 'unmatched_default') {
          // Only differences by design: the new OTP rule; unmatched is its own state.
          expect(
            r.kind === 'unmatched' || (r.kind === 'skipped' && r.classification === 'otp'),
          ).toBe(true);
        } else {
          expect(r).toEqual({
            kind: 'skipped',
            classification: ref.reason,
            stage: 'reject_rule',
            rule: ref.meta.ruleName,
          });
        }
        return;
      }
      expect(r).toMatchObject({
        kind: 'transaction',
        direction: ref.classification === 'actual_debit' ? 'debit' : 'credit',
        amount: ref.amount,
        merchant: ref.payee,
        date: ref.txn_date,
        txnRef: ref.upi_ref,
        stage: 'extract_rule',
        rule: ref.meta.ruleName,
      });
    },
  );

  it('the 7 Parser Lab samples: debit, credit, skip, skip, ATM, card, skip', () => {
    const kinds = (reference as { sms: string }[]).slice(0, 7).map((r) => {
      const c = classifySms(r.sms);
      return c.kind === 'transaction'
        ? `${c.direction}:${c.rule}`
        : `${c.kind}:${c.classification}`;
    });
    expect(kinds).toEqual([
      'debit:upi_debit',
      'credit:upi_credit',
      'skipped:bill_reminder',
      'skipped:failed_autopay',
      'debit:cardless_atm_withdrawal',
      'debit:credit_card_spend',
      'skipped:statement_notice',
    ]);
  });
});

describe('each reject rule', () => {
  const cases: [string, string][] = [
    ['bill_reminder_auto_debit', 'Your bill will auto-deduct on 12-Jun-26.'],
    [
      'bill_reminder_please_ignore',
      'Rs 349 amount will be debited from a/c. Please ignore if paid.',
    ],
    ['failed_autopay_cbs_rejection', 'Not debited due to CBS rejection 0116'],
    ['statement_notice', 'Your Statement is sent to you@x.com'],
    ['fee_change_noise', 'Revised fee for SMS alerts updated'],
    ['generic_promo_noise', 'Big offers! For details, visit icici.bank.in'],
    ['otp', '482910 is your One Time Password for login'],
  ];
  it.each(cases)('%s', (rule, sms) => {
    expect(classifySms(sms)).toMatchObject({ kind: 'skipped', stage: 'reject_rule', rule });
  });

  it('OTP variants; a real debit that mentions OTP is not rejected', () => {
    expect(classifySms('Your OTP is 1234')).toMatchObject({ classification: 'otp' });
    expect(classifySms('Code 1234. Do not share it with anyone.')).toMatchObject({
      classification: 'otp',
    });
    expect(
      classifySms(
        'ICICI Bank Acct XX219 debited for Rs 40.00 on 01-Jun-26; CAFE credited. UPI:651870302957. Never share OTP. Do not share card details',
      ),
    ).toMatchObject({ kind: 'transaction', rule: 'upi_debit' });
    expect(REJECT_RULES).toHaveLength(7);
    expect(EXTRACT_RULES.map((r) => r.name)).toEqual([
      'upi_debit',
      'upi_credit',
      'imps_credit',
      'cardless_atm_withdrawal',
      'credit_card_spend',
      'bill_autodebit_paid',
      'credit_card_autopay_confirmation',
    ]);
  });
});

describe('helpers', () => {
  it('dates', () => {
    expect(parseBankDate('01-Jun-26')).toBe('2026-06-01');
    expect(parseBankDate('12-06-2026')).toBe('2026-06-12');
    expect(parseBankDate('01-Xyz-26')).toBeNull();
    expect(parseBankDate('2026-06-01')).toBeNull();
    // a bad month inside a matching SMS → unmatched, never mis-dated
    expect(
      classifySms('ICICI Bank Acct XX219 debited for Rs 40.00 on 01-Xyz-26; A credited. UPI:1'),
    ).toMatchObject({ kind: 'unmatched' });
  });

  it('AC2 helper: stableHash is stable and the reference’s', () => {
    expect(stableHash('abc')).toBe(stableHash('abc'));
    expect(stableHash('abc')).not.toBe(stableHash('abd'));
    expect(syntheticRef('  x  ')).toBe(syntheticRef('x'));
    // reference output for sample 6 (credit-card spend) above
    expect((reference as { ref: Ref }[])[5]!.ref.upi_ref).toBe(
      syntheticRef((reference as { sms: string }[])[5]!.sms),
    );
  });

  it('categories: merchant map first, then reference hints, credits are income', () => {
    expect(inferCategory('credit', 'Swiggy', '')).toBe('income');
    expect(inferCategory('debit', 'Swiggy Instamart', '')).toBe('food');
    expect(inferCategory('debit', 'Uber India', '')).toBe('transport');
    expect(inferCategory('debit', 'Apollo Pharmacy', '')).toBe('health');
    expect(inferCategory('debit', 'Netflix', '')).toBe('other');
    expect(inferCategory('debit', 'GITHUB', '')).toBe('bills');
    expect(inferCategory('debit', 'Amazon Pay', 'spent using card')).toBe('shopping');
    expect(inferCategory('debit', 'Murugan unavagam', '')).toBe('food');
    expect(inferCategory('debit', 'Raja', 'cardless withdrawal')).toBe('other');
    expect(inferCategory('debit', null, 'mobile recharge')).toBe('bills');
    expect(inferCategory('debit', 'Ravi', '')).toBe('other');
    expect(inferCategory('debit', 'Corner shop', '')).toBe('shopping');
  });

  it('the app and Edge Function copies are identical', () => {
    // Jest runs from the repo root.
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest-only file read
    const { readFileSync } = require('fs') as { readFileSync: (p: string, e: 'utf8') => string };
    expect(readFileSync('src/features/money/lib/smsParser.ts', 'utf8')).toBe(
      readFileSync('supabase/functions/_shared/smsParser.ts', 'utf8'),
    );
  });
});
