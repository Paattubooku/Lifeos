import { TOKEN_BODY_LENGTH, TOKEN_PREFIX } from './ingest';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
/** Largest multiple of 62 below 256: bytes at or above it are dropped (no modulo bias). */
const LIMIT = 248;

/**
 * `lifeos_pat_<32 letters/digits>` from secure random bytes (pass more bytes
 * than needed; returns null if they run out before 32 unbiased characters).
 */
export function tokenFromBytes(bytes: ArrayLike<number>): string | null {
  let body = '';
  for (let i = 0; i < bytes.length && body.length < TOKEN_BODY_LENGTH; i++) {
    const b = bytes[i] as number;
    if (b < LIMIT) body += ALPHABET[b % 62];
  }
  return body.length === TOKEN_BODY_LENGTH ? `${TOKEN_PREFIX}${body}` : null;
}

export type TokenRow = {
  client_id: string;
  name: string;
  last4: string;
  created_at?: string | null;
  last_used_at: string | null;
  revoked_at: string | null;
  deleted_at?: string | null;
};

/** Active first (newest first), then revoked. */
export function sortTokens<T extends TokenRow>(rows: readonly T[]): T[] {
  return rows
    .filter((t) => !t.deleted_at)
    .sort((a, b) =>
      !!a.revoked_at !== !!b.revoked_at
        ? a.revoked_at
          ? 1
          : -1
        : String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')),
    );
}

/** "2 min ago" / "3 h ago" / "4 days ago" / "never used". */
export function ago(iso: string | null, now: number): string {
  if (!iso) return 'never used';
  const min = Math.max(0, Math.round((now - Date.parse(iso)) / 60000));
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 48) return `${h} h ago`;
  return `${Math.round(h / 24)} days ago`;
}

/** Best-effort amount for "Mark as expense" on a skipped SMS (Rs / INR / ₹). */
export function guessAmount(sms: string): number | null {
  const m = /(?:Rs\.?|INR|₹)\s*([\d,]+(?:\.\d{1,2})?)/i.exec(sms);
  if (!m) return null;
  const n = Number((m[1] as string).replace(/,/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}
