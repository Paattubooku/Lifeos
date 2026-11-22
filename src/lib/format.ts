/**
 * Display formatting (PRD §4.4). Implemented by hand instead of Intl 'en-IN'
 * so output is identical on Hermes iOS, Hermes Android and Node (tests).
 */

/** 123456.7 → "1,23,456.7" (Indian digit grouping). */
export function formatIndianNumber(value: number, decimals = 0): string {
  if (!Number.isFinite(value)) return '—';
  const negative = value < 0;
  const fixed = Math.abs(value).toFixed(decimals);
  const [int = '0', frac] = fixed.split('.');
  const last3 = int.slice(-3);
  const rest = int.slice(0, -3);
  const grouped = rest ? `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${last3}` : last3;
  return `${negative ? '−' : ''}${grouped}${frac ? `.${frac}` : ''}`;
}

/** 123456 → "₹1,23,456" */
export function formatInr(value: number, decimals = 0): string {
  const s = formatIndianNumber(value, decimals);
  return s.startsWith('−') ? `−₹${s.slice(1)}` : `₹${s}`;
}

export type Clock12 = { hour: number; minute: number; period: 'am' | 'pm' };

/** "HH:mm" (24 h, storage) → parts. Throws on malformed input. */
export function parseClock(hhmm: string): { hours: number; minutes: number } {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!m) throw new Error(`Invalid time "${hhmm}"`);
  const hours = Number(m[1]);
  const minutes = Number(m[2]);
  if (hours > 23 || minutes > 59) throw new Error(`Invalid time "${hhmm}"`);
  return { hours, minutes };
}

export function to12h(hhmm: string): Clock12 {
  const { hours, minutes } = parseClock(hhmm);
  return {
    hour: hours % 12 === 0 ? 12 : hours % 12,
    minute: minutes,
    period: hours < 12 ? 'am' : 'pm',
  };
}

export function from12h({ hour, minute, period }: Clock12): string {
  const h24 = (hour % 12) + (period === 'pm' ? 12 : 0);
  return `${String(h24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/** "05:30" → "5:30 am" ; "13:05" → "1:05 pm" */
export function formatClock(hhmm: string): string {
  const { hour, minute, period } = to12h(hhmm);
  return `${hour}:${String(minute).padStart(2, '0')} ${period}`;
}
