import { logicalDate } from '@/lib/dates';
import { CATEGORIES } from '@/test/moneyFixtures';

import {
  bearer,
  categoryIdFor,
  type IngestStore,
  ingestResponse,
  isTokenShaped,
  istLogicalDate,
  last4,
  parseIngestBody,
  processInbox,
  quickLogRow,
  sha256Hex,
} from '../lib/ingest';
import { classifySms } from '../lib/smsParser';
import reference from './fixtures/sms-reference.json';

const SAMPLES = (reference as { sms: string }[]).map((r) => r.sms);
const UPI_DEBIT = SAMPLES[0]!;
const CARD_SPEND = SAMPLES[5]!; // no ref in the SMS → sig_<stableHash>
const BILL_REMINDER = SAMPLES[2]!;

/** In-memory stand-in for one user's tables, with the unique (user_id, txn_ref) index. */
function fakeDb() {
  const db = {
    inbox: [] as {
      id: string;
      raw_sms: string;
      received_at: string;
      attempts: number;
      last_error?: string;
    }[],
    expenses: [] as Record<string, unknown>[],
    skipped: [] as Record<string, unknown>[],
    n: 0,
  };
  const store: IngestStore = {
    pendingInbox: async (limit) => db.inbox.slice(0, limit),
    insertExpense: async (row) => {
      if (db.expenses.some((e) => e.txn_ref === row.txn_ref)) return 'duplicate';
      db.expenses.push(row);
      return 'inserted';
    },
    insertSkipped: async (row) => void db.skipped.push(row),
    deleteInbox: async (id) => void (db.inbox = db.inbox.filter((i) => i.id !== id)),
    markFailed: async (id, error, attempts) => {
      const i = db.inbox.find((x) => x.id === id)!;
      i.attempts = attempts;
      i.last_error = error;
    },
    categoryId: (key) => categoryIdFor(key, CATEGORIES),
  };
  const post = (raw: string) => {
    const id = `in${++db.n}`;
    db.inbox.push({ id, raw_sms: raw, received_at: '2026-06-01T10:00:00Z', attempts: 0 });
    return id;
  };
  return { db, store, post };
}

describe('F19 AC2: the same SMS twice creates one expense', () => {
  it('UPI ref and the credit-card stableHash both dedupe', async () => {
    const { db, store, post } = fakeDb();
    const a = post(UPI_DEBIT);
    const b = post(CARD_SPEND);
    const first = await processInbox(store, classifySms);
    expect(first).toMatchObject({ processed: 2, expenses: 2, duplicates: 0, leftInInbox: 0 });
    expect(ingestResponse(first.outcomes[a])).toMatchObject({
      status: 'expense',
      amount: 40,
      merchant: 'HOT N SPICY',
    });
    expect(db.expenses[1]).toMatchObject({
      txn_ref: expect.stringMatching(/^sig_[0-9a-f]{16}$/),
      payment_method: 'card',
      source: 'sms',
      parse_rule: 'credit_card_spend',
      category_id: 'bills',
    });
    void b;
    const again = [post(UPI_DEBIT), post(`  ${CARD_SPEND}  `)];
    const second = await processInbox(store, classifySms);
    expect(second).toMatchObject({ processed: 2, expenses: 0, duplicates: 2 });
    expect(ingestResponse(second.outcomes[again[0]!])).toEqual({
      status: 'duplicate',
      duplicate: true,
      rule: 'upi_debit',
    });
    expect(db.expenses).toHaveLength(2);
    expect(db.inbox).toHaveLength(0);
  });

  it('skipped and unmatched go to expense_skipped with stage and rule', async () => {
    const { db, store, post } = fakeDb();
    post(BILL_REMINDER);
    post('Hello from your bank');
    const r = await processInbox(store, classifySms);
    expect(r).toMatchObject({ skipped: 2, processed: 2 });
    expect(db.skipped.map((s) => [s.stage, s.rule, s.classification])).toEqual([
      ['reject_rule', 'bill_reminder_auto_debit', 'bill_reminder'],
      ['unmatched_default', null, 'unmatched'],
    ]);
  });
});

describe('F19 AC3: a parser error leaves the row in the inbox; the next run processes it', () => {
  it('retry', async () => {
    const { db, store, post } = fakeDb();
    const id = post(UPI_DEBIT);
    post(BILL_REMINDER);
    let broken = true;
    const flaky = (sms: string) => {
      if (broken && sms === UPI_DEBIT) throw new Error('parser exploded');
      return classifySms(sms);
    };
    const r1 = await processInbox(store, flaky);
    expect(r1).toMatchObject({ processed: 1, leftInInbox: 1, skipped: 1 });
    expect(ingestResponse(r1.outcomes[id])).toEqual({ status: 'error', error: 'parser exploded' });
    expect(db.inbox).toEqual([
      expect.objectContaining({ id, attempts: 1, last_error: 'parser exploded' }),
    ]);
    broken = false;
    const r2 = await processInbox(store, flaky);
    expect(r2).toMatchObject({ processed: 1, expenses: 1, leftInInbox: 0 });
    expect(db.inbox).toHaveLength(0);
    // a failing database write also keeps the message
    const { store: s2, db: d2, post: p2 } = fakeDb();
    p2(UPI_DEBIT);
    const failing = { ...s2, insertExpense: async () => Promise.reject(new Error('db down')) };
    expect(await processInbox(failing, classifySms)).toMatchObject({ leftInInbox: 1 });
    expect(d2.inbox).toHaveLength(1);
    expect(ingestResponse(undefined)).toEqual({ status: 'queued' });
  });
});

describe('F19 AC4 helpers: tokens', () => {
  it('shape, bearer, hashing (never plain text)', async () => {
    const token = `lifeos_pat_${'a1B2'.repeat(8)}`;
    expect(isTokenShaped(token)).toBe(true);
    expect(isTokenShaped('lifeos_pat_short')).toBe(false);
    expect(isTokenShaped(`${token}!`)).toBe(false);
    expect(last4(token)).toBe('a1B2');
    expect(bearer(`Bearer ${token}`)).toBe(token);
    expect(bearer('Basic x')).toBeNull();
    expect(bearer(null)).toBeNull();
    expect(await sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });
});

describe('ingest body and quick-log', () => {
  const now = Date.parse('2026-11-24T00:30:00+05:30'); // before 03:00 → still the 23rd
  it('logical IST date matches the app’s', () => {
    expect(istLogicalDate(now)).toBe('2026-11-23');
    for (const t of [
      now,
      Date.parse('2026-11-24T03:00:00+05:30'),
      Date.parse('2026-12-31T23:59:00Z'),
    ])
      expect(istLogicalDate(t)).toBe(logicalDate(t));
  });

  it('ingest body', () => {
    expect(parseIngestBody({ text: ' hi ' }, now)).toEqual({
      ok: true,
      text: 'hi',
      receivedAt: new Date(now).toISOString(),
    });
    expect(parseIngestBody({ sms: 'x', received_at: '2026-06-01T10:00:00Z' }, now)).toMatchObject({
      receivedAt: '2026-06-01T10:00:00.000Z',
    });
    expect(parseIngestBody({}, now)).toMatchObject({ ok: false });
    expect(parseIngestBody(null, now)).toMatchObject({ ok: false });
    expect(parseIngestBody({ text: 'x'.repeat(2001) }, now)).toMatchObject({
      ok: false,
      error: 'SMS too long',
    });
  });

  it('water and expense rows; errors', () => {
    expect(quickLogRow('water', { ml: 500 }, now, CATEGORIES)).toEqual({
      ok: true,
      value: {
        table: 'water_log',
        row: { date: '2026-11-23', amount_ml: 500, logged_at: new Date(now).toISOString() },
      },
    });
    expect(quickLogRow('water', { amount_ml: '250' }, now, CATEGORIES)).toMatchObject({ ok: true });
    expect(quickLogRow('water', { ml: 0 }, now, CATEGORIES)).toMatchObject({ ok: false });
    expect(quickLogRow('water', { ml: 2.5 }, now, CATEGORIES)).toMatchObject({ ok: false });
    expect(
      quickLogRow(
        'expense',
        { amount: 240.456, category: 'food', payee: ' Murugan ', note: '' },
        now,
        CATEGORIES,
      ),
    ).toEqual({
      ok: true,
      value: {
        table: 'expense',
        row: {
          date: '2026-11-23',
          amount_inr: 240.46,
          direction: 'debit',
          category_id: 'food',
          merchant: 'Murugan',
          note: null,
          payment_method: 'upi',
          source: 'quick',
        },
      },
    });
    expect(
      quickLogRow('expense', { amount: 10, category: 'Bills' }, now, CATEGORIES),
    ).toMatchObject({ value: { row: { category_id: 'bills' } } });
    expect(quickLogRow('expense', { amount: 10, category: 'pets' }, now, CATEGORIES)).toMatchObject(
      { value: { row: { category_id: null } } },
    );
    expect(quickLogRow('expense', { amount: -1 }, now, CATEGORIES)).toMatchObject({ ok: false });
    expect(quickLogRow('steps', {}, now, CATEGORIES)).toMatchObject({ ok: false });
    expect(categoryIdFor('nope', CATEGORIES)).toBeNull();
    expect(categoryIdFor('income', CATEGORIES)).toBe('income');
  });

  it('the app and Edge Function copies are identical', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest-only file read
    const { readFileSync } = require('fs') as { readFileSync: (p: string, e: 'utf8') => string };
    expect(readFileSync('src/features/money/lib/ingest.ts', 'utf8')).toBe(
      readFileSync('supabase/functions/_shared/ingest.ts', 'utf8'),
    );
  });
});
