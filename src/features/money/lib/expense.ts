import type { DateString } from '@/lib/dates';

import type { ExpenseLike } from './analytics';

export const PAGE_SIZE = 15;
export const MAX_AMOUNT = 9_99_999.99;
export type Direction = 'debit' | 'credit';
export type PaymentMethod = 'upi' | 'cash' | 'card' | 'netbanking' | 'other';
export const PAYMENT_METHODS: readonly { value: PaymentMethod; label: string }[] = [
  { value: 'upi', label: 'UPI' },
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'other', label: 'Other' },
];
export const methodLabel = (m: string) =>
  m === 'netbanking'
    ? 'Net banking'
    : (PAYMENT_METHODS.find((p) => p.value === m)?.label ?? 'Other');

/** Keypad: digits, one dot, two decimals, ≤ 9,99,999.99. Returns the new text. */
export function keypadInput(current: string, key: string): string {
  if (key === 'back') return current.slice(0, -1);
  if (key === '.') {
    if (current.includes('.')) return current;
    return current === '' ? '0.' : `${current}.`;
  }
  if (!/^\d$/.test(key)) return current;
  const [, frac] = current.split('.');
  if (frac !== undefined && frac.length >= 2) return current;
  const next = current === '0' ? key : `${current}${key}`;
  return Number(next) > MAX_AMOUNT ? current : next;
}

export const parseAmount = (text: string): number | null => {
  const n = Number(text);
  return Number.isFinite(n) && n > 0 && n <= MAX_AMOUNT ? Math.round(n * 100) / 100 : null;
};

export type NewExpense = {
  amount: number;
  date: DateString;
  direction: Direction;
  categoryId: string | null;
  method: PaymentMethod;
  merchant: string;
  note: string;
  recurring: boolean;
};

/** The `expense` row for a manual entry (`txn_ref` null; client_id dedupes). */
export function planExpense(e: NewExpense): Record<string, unknown> {
  return {
    date: e.date,
    amount_inr: e.amount,
    direction: e.direction,
    category_id: e.categoryId,
    payment_method: e.method,
    merchant: e.merchant.trim().slice(0, 80) || null,
    note: e.note.trim().slice(0, 200) || null,
    is_recurring: e.recurring,
    source: 'manual',
  };
}

export type TypeFilter = 'all' | 'debit' | 'credit';
export type Filters = { type: TypeFilter; category: string | 'all'; search: string };
export const NO_FILTERS: Filters = { type: 'all', category: 'all', search: '' };

type Row = ExpenseLike & { note?: string | null };

/**
 * Port of My-Tracker `useExpenseFilters`: type, category, then search. The
 * search also matches the note and the amount (Money-Transactions design).
 */
export function filterExpenses<T extends Row>(rows: readonly T[], f: Filters): T[] {
  const term = f.search.trim().toLowerCase();
  return rows.filter((e) => {
    if (e.deleted_at) return false;
    if (f.type !== 'all' && e.direction !== f.type) return false;
    if (f.category !== 'all' && e.category_id !== f.category) return false;
    if (!term) return true;
    return (
      (e.merchant ?? '').toLowerCase().includes(term) ||
      (e.note ?? '').toLowerCase().includes(term) ||
      String(Number(e.amount_inr)).includes(term.replace(/[₹,\s]/g, ''))
    );
  });
}

export const hasFilters = (f: Filters) =>
  f.type !== 'all' || f.category !== 'all' || f.search.trim() !== '';

/** Newest first: date, then logged time. */
export function newestFirst<T extends Row & { created_at?: string | null }>(
  rows: readonly T[],
): T[] {
  return [...rows].sort((a, b) =>
    a.date !== b.date
      ? b.date.localeCompare(a.date)
      : String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')),
  );
}

/** Day sections for the list: date, net spend of the shown rows, rows. */
export function byDay<T extends Row>(
  rows: readonly T[],
): { date: string; spent: number; rows: T[] }[] {
  const out: { date: string; spent: number; rows: T[] }[] = [];
  for (const e of rows) {
    let g = out.at(-1);
    if (!g || g.date !== e.date) {
      g = { date: e.date, spent: 0, rows: [] };
      out.push(g);
    }
    g.rows.push(e);
    if (e.direction === 'debit') g.spent += Number(e.amount_inr) || 0;
  }
  return out;
}
