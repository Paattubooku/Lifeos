import { formatClock, formatIndianNumber, formatInr, from12h, parseClock, to12h } from '../format';

describe('formatIndianNumber (PRD §4.4)', () => {
  it.each([
    [0, '0'],
    [999, '999'],
    [1000, '1,000'],
    [18000, '18,000'],
    [123456, '1,23,456'],
    [12345678, '1,23,45,678'],
  ])('%d → %s', (n, s) => {
    expect(formatIndianNumber(n)).toBe(s);
  });

  it('keeps decimals and signs', () => {
    expect(formatIndianNumber(91.04, 1)).toBe('91.0');
    expect(formatIndianNumber(123456.789, 2)).toBe('1,23,456.79');
    expect(formatIndianNumber(-2340)).toBe('−2,340');
  });

  it('shows a dash for non-numbers', () => {
    expect(formatIndianNumber(Number.NaN)).toBe('—');
  });
});

describe('formatInr', () => {
  it('prefixes the rupee sign', () => {
    expect(formatInr(123456)).toBe('₹1,23,456');
    expect(formatInr(-240)).toBe('−₹240');
    expect(formatInr(99.5, 2)).toBe('₹99.50');
  });
});

describe('clock helpers', () => {
  it('formats 24 h storage time as a 12 h label', () => {
    expect(formatClock('05:30')).toBe('5:30 am');
    expect(formatClock('00:05')).toBe('12:05 am');
    expect(formatClock('12:00')).toBe('12:00 pm');
    expect(formatClock('13:05')).toBe('1:05 pm');
    expect(formatClock('22:00')).toBe('10:00 pm');
  });

  it('round-trips through 12 h parts', () => {
    for (const t of ['00:00', '05:00', '11:59', '12:00', '12:30', '21:30', '23:55']) {
      expect(from12h(to12h(t))).toBe(t);
    }
  });

  it('rejects malformed times', () => {
    expect(() => parseClock('5am')).toThrow('Invalid time');
    expect(() => parseClock('24:00')).toThrow('Invalid time');
    expect(() => parseClock('10:60')).toThrow('Invalid time');
    expect(parseClock('5:07')).toEqual({ hours: 5, minutes: 7 });
  });
});
