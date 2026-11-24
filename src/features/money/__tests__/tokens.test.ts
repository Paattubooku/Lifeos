import { isTokenShaped } from '../lib/ingest';
import { ago, guessAmount, sortTokens, tokenFromBytes } from '../lib/tokens';

describe('tokens', () => {
  it('lifeos_pat_ + 32 characters, unbiased', () => {
    const bytes = Array.from({ length: 48 }, (_, i) => (i * 37 + 11) % 256);
    const t = tokenFromBytes(bytes)!;
    expect(isTokenShaped(t)).toBe(true);
    expect(tokenFromBytes(Array.from({ length: 48 }, () => 250))).toBeNull();
    expect(tokenFromBytes([0, 61, 62, 247, 248, 255])).toBeNull();
  });

  it('sort, ago, amount guess', () => {
    const rows = [
      {
        client_id: 'a',
        name: 'A',
        last4: '1111',
        created_at: '1',
        last_used_at: null,
        revoked_at: 'x',
      },
      {
        client_id: 'b',
        name: 'B',
        last4: '2222',
        created_at: '2',
        last_used_at: null,
        revoked_at: null,
      },
      {
        client_id: 'c',
        name: 'C',
        last4: '3333',
        created_at: '3',
        last_used_at: null,
        revoked_at: null,
      },
      {
        client_id: 'd',
        name: 'D',
        last4: '4444',
        created_at: '4',
        last_used_at: null,
        revoked_at: null,
        deleted_at: 'x',
      },
    ];
    expect(sortTokens(rows).map((r) => r.client_id)).toEqual(['c', 'b', 'a']);
    const now = Date.parse('2026-11-24T10:00:00Z');
    expect(ago(null, now)).toBe('never used');
    expect(ago('2026-11-24T09:59:50Z', now)).toBe('just now');
    expect(ago('2026-11-24T09:58:00Z', now)).toBe('2 min ago');
    expect(ago('2026-11-24T07:00:00Z', now)).toBe('3 h ago');
    expect(ago('2026-11-20T10:00:00Z', now)).toBe('4 days ago');
    expect(guessAmount('INR 1,299.00 spent on card')).toBe(1299);
    expect(guessAmount('Rs.220.00 debited')).toBe(220);
    expect(guessAmount('₹ 45 paid')).toBe(45);
    expect(guessAmount('Your OTP is 1234')).toBeNull();
    expect(guessAmount('Rs 0 due')).toBeNull();
  });
});
