/**
 * Server-side core of the `ingest-sms` and `quick-log` Edge Functions (PRD
 * F19): token checks, the inbox queue and quick-log validation. Pure and
 * dependency-free; byte-identical to `supabase/functions/_shared/ingest.ts`
 * (a test checks). The Deno entry points only wire it to Supabase.
 */

export const TOKEN_PREFIX = 'lifeos_pat_';
export const TOKEN_BODY_LENGTH = 32;
const TOKEN_RE = /^lifeos_pat_[A-Za-z0-9]{32}$/;
export const MAX_SMS_LENGTH = 2000;
export const INBOX_BATCH = 200;
export const MAX_WATER_ML = 2000;
export const MAX_QUICK_AMOUNT = 999999.99;

export const isTokenShaped = (token: string) => TOKEN_RE.test(token);
export const last4 = (token: string) => token.slice(-4);

/** "Authorization: Bearer x" → "x" (or null). */
export function bearer(header: string | null | undefined): string | null {
  const m = /^Bearer\s+(\S+)$/i.exec(header ?? '');
  return m ? (m[1] as string) : null;
}

/** SHA-256 hex (Web Crypto: Deno and modern runtimes). Tokens are only ever stored hashed. */
export async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

const IST_OFFSET_MS = 5.5 * 3_600_000;
const DAY_START_HOUR = 3;

/** The logical day (IST, starting 03:00) of an instant; same rule as src/lib/dates.ts. */
export function istLogicalDate(ms: number): string {
  // Dependency-free server copy of the dates.ts rule (shifted to IST − 3 h first); tested equal.
  // eslint-disable-next-line no-restricted-syntax
  return new Date(ms + IST_OFFSET_MS - DAY_START_HOUR * 3_600_000).toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Inbox queue (reference My-Tracker `processInbox`, made per-user and secure)
// ---------------------------------------------------------------------------

export type ParsedSms =
  | {
      kind: 'transaction';
      direction: 'debit' | 'credit';
      amount: number;
      merchant: string | null;
      date: string;
      txnRef: string;
      category: string;
      stage: string;
      rule: string;
    }
  | { kind: 'skipped' | 'unmatched'; classification: string; stage: string; rule: string | null };

export type InboxItem = { id: string; raw_sms: string; received_at: string; attempts: number };

/** What the processor needs from the database, already scoped to one user. */
export type IngestStore = {
  pendingInbox: (limit: number) => Promise<InboxItem[]>;
  /** Insert ignoring a duplicate txn_ref; 'duplicate' when the ref already exists. */
  insertExpense: (row: Record<string, unknown>) => Promise<'inserted' | 'duplicate'>;
  insertSkipped: (row: Record<string, unknown>) => Promise<void>;
  deleteInbox: (id: string) => Promise<void>;
  markFailed: (id: string, error: string, attempts: number) => Promise<void>;
  /** The user's category id for a parser key (food, bills, …, income), or null. */
  categoryId: (key: string) => string | null;
};

export type Outcome =
  | {
      status: 'expense';
      direction: 'debit' | 'credit';
      amount: number;
      merchant: string | null;
      date: string;
      rule: string;
    }
  | { status: 'duplicate'; rule: string }
  | { status: 'skipped'; classification: string; rule: string | null }
  | { status: 'error'; error: string };

export type ProcessResult = {
  processed: number;
  expenses: number;
  duplicates: number;
  skipped: number;
  leftInInbox: number;
  outcomes: Record<string, Outcome>;
};

/**
 * Classify every pending message, oldest first. A message leaves the inbox
 * only after its expense / skipped row is written; any throw leaves it there
 * (attempts + 1) for the next run (AC3).
 */
export async function processInbox(
  store: IngestStore,
  classify: (sms: string) => ParsedSms,
): Promise<ProcessResult> {
  const pending = await store.pendingInbox(INBOX_BATCH);
  const out: ProcessResult = {
    processed: 0,
    expenses: 0,
    duplicates: 0,
    skipped: 0,
    leftInInbox: 0,
    outcomes: {},
  };
  for (const item of pending) {
    try {
      const p = classify(item.raw_sms);
      if (p.kind === 'transaction') {
        const res = await store.insertExpense({
          date: p.date,
          amount_inr: p.amount,
          direction: p.direction,
          category_id: store.categoryId(p.category),
          merchant: p.merchant,
          payment_method: p.rule.startsWith('credit_card')
            ? 'card'
            : p.rule === 'cardless_atm_withdrawal'
              ? 'other'
              : 'upi',
          source: 'sms',
          txn_ref: p.txnRef,
          parse_rule: p.rule,
          raw_sms: item.raw_sms,
        });
        if (res === 'duplicate') {
          out.duplicates += 1;
          out.outcomes[item.id] = { status: 'duplicate', rule: p.rule };
        } else {
          out.expenses += 1;
          out.outcomes[item.id] = {
            status: 'expense',
            direction: p.direction,
            amount: p.amount,
            merchant: p.merchant,
            date: p.date,
            rule: p.rule,
          };
        }
      } else {
        await store.insertSkipped({
          raw_sms: item.raw_sms,
          received_at: item.received_at,
          stage: p.stage,
          rule: p.rule,
          classification: p.classification,
        });
        out.skipped += 1;
        out.outcomes[item.id] = {
          status: 'skipped',
          classification: p.classification,
          rule: p.rule,
        };
      }
      await store.deleteInbox(item.id);
      out.processed += 1;
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      out.leftInInbox += 1;
      out.outcomes[item.id] = { status: 'error', error };
      await store
        .markFailed(item.id, error.slice(0, 500), item.attempts + 1)
        .catch(() => undefined);
    }
  }
  return out;
}

/** Validate an ingest body: `{"text": "<sms>", "received_at"?: iso}` (DESIGN_NOTES A15). */
export function parseIngestBody(
  body: unknown,
  now: number,
): { ok: true; text: string; receivedAt: string } | { ok: false; error: string } {
  const b = (body ?? {}) as { text?: unknown; sms?: unknown; received_at?: unknown };
  const text = typeof b.text === 'string' ? b.text : typeof b.sms === 'string' ? b.sms : null;
  if (!text || !text.trim()) return { ok: false, error: 'Send {"text": "<the SMS>"}' };
  if (text.length > MAX_SMS_LENGTH) return { ok: false, error: 'SMS too long' };
  const at = typeof b.received_at === 'string' ? Date.parse(b.received_at) : NaN;
  return {
    ok: true,
    text: text.trim(),
    receivedAt: new Date(Number.isFinite(at) ? at : now).toISOString(),
  };
}

/** The response for one posted SMS: `{duplicate: true}` for a known reference (AC2). */
export function ingestResponse(outcome: Outcome | undefined): Record<string, unknown> {
  if (!outcome) return { status: 'queued' };
  if (outcome.status === 'duplicate')
    return { status: 'duplicate', duplicate: true, rule: outcome.rule };
  return { ...outcome };
}

// ---------------------------------------------------------------------------
// Quick-log (Siri / Shortcuts)
// ---------------------------------------------------------------------------

export type QuickRow =
  | { table: 'water_log'; row: { date: string; amount_ml: number; logged_at: string } }
  | {
      table: 'expense';
      row: {
        date: string;
        amount_inr: number;
        direction: 'debit';
        category_id: string | null;
        merchant: string | null;
        note: string | null;
        payment_method: 'upi';
        source: 'quick';
      };
    };

const text80 = (v: unknown, n: number) =>
  typeof v === 'string' && v.trim() ? v.trim().slice(0, n) : null;

/**
 * `POST /quick-log/water {"ml": 500}` or `POST /quick-log/expense
 * {"amount": 240, "category"?, "payee"?, "note"?}`. Category matches the
 * user's category name, case-insensitive, by prefix ("food" → "Food & groceries").
 */
export function quickLogRow(
  kind: string,
  body: unknown,
  now: number,
  categories: readonly { id: string; name: string }[],
): { ok: true; value: QuickRow } | { ok: false; error: string } {
  const b = (body ?? {}) as Record<string, unknown>;
  const date = istLogicalDate(now);
  if (kind === 'water') {
    const ml = Number(b.ml ?? b.amount_ml);
    if (!Number.isInteger(ml) || ml < 1 || ml > MAX_WATER_ML)
      return { ok: false, error: `Send {"ml": 1–${MAX_WATER_ML}}` };
    return {
      ok: true,
      value: {
        table: 'water_log',
        row: { date, amount_ml: ml, logged_at: new Date(now).toISOString() },
      },
    };
  }
  if (kind === 'expense') {
    const amount = Math.round(Number(b.amount) * 100) / 100;
    if (!(amount > 0) || amount > MAX_QUICK_AMOUNT)
      return { ok: false, error: 'Send {"amount": <rupees>}' };
    const wanted = text80(b.category, 40)?.toLowerCase() ?? null;
    const cat = wanted
      ? (categories.find((c) => c.name.toLowerCase() === wanted) ??
        categories.find((c) => c.name.toLowerCase().startsWith(wanted)) ??
        null)
      : null;
    return {
      ok: true,
      value: {
        table: 'expense',
        row: {
          date,
          amount_inr: amount,
          direction: 'debit',
          category_id: cat?.id ?? null,
          merchant: text80(b.payee ?? b.merchant, 80),
          note: text80(b.note, 200),
          payment_method: 'upi',
          source: 'quick',
        },
      },
    };
  }
  return { ok: false, error: 'Use /quick-log/water or /quick-log/expense' };
}

/** Parser category key → the user's category (by name), Income for credits. */
export function categoryIdFor(
  key: string,
  categories: readonly { id: string; name: string }[],
): string | null {
  const names: Record<string, RegExp> = {
    food: /^food/i,
    bills: /^bills/i,
    transport: /^transport/i,
    health: /^health/i,
    shopping: /^shopping/i,
    other: /^other/i,
    income: /^income/i,
  };
  const re = names[key];
  return (re && categories.find((c) => re.test(c.name))?.id) || null;
}
