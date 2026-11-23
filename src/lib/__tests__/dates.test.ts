import {
  logicalMoment,
  addDays,
  daysBetween,
  istDate,
  istMinutesOfDay,
  isoWeekday,
  logicalDate,
  parseDate,
  todayLogical,
  weekStart,
} from '../dates';

// IST = UTC+05:30. 2026-11-23 00:30 IST = 2026-11-22T19:00Z.
const ist = (local: string) => new Date(`${local}+05:30`);

describe('logicalDate (PRD §4.1: day starts 03:00 IST)', () => {
  it('maps times before 03:00 to the previous day', () => {
    expect(logicalDate(ist('2026-11-23T00:30:00'))).toBe('2026-11-22');
    expect(logicalDate(ist('2026-11-23T02:59:59'))).toBe('2026-11-22');
  });

  it('starts the new day at 03:00', () => {
    expect(logicalDate(ist('2026-11-23T03:00:00'))).toBe('2026-11-23');
    expect(logicalDate(ist('2026-11-23T23:59:00'))).toBe('2026-11-23');
  });

  it('uses IST, not the device or UTC date', () => {
    // 22:00 UTC on the 22nd is 03:30 IST on the 23rd.
    expect(logicalDate('2026-11-22T22:00:00Z')).toBe('2026-11-23');
    // 20:00 UTC = 01:30 IST next calendar day, still the 22nd logically.
    expect(logicalDate(Date.parse('2026-11-22T20:00:00Z'))).toBe('2026-11-22');
    expect(istDate('2026-11-22T20:00:00Z')).toBe('2026-11-23');
  });

  it('crosses month and year boundaries', () => {
    expect(logicalDate(ist('2027-01-01T01:00:00'))).toBe('2026-12-31');
  });

  it('todayLogical uses the given clock', () => {
    expect(todayLogical(ist('2026-11-23T05:10:00'))).toBe('2026-11-23');
  });

  it('rejects invalid timestamps', () => {
    expect(() => logicalDate('not a date')).toThrow('Invalid timestamp');
  });
});

describe('day arithmetic', () => {
  it('istMinutesOfDay', () => {
    expect(istMinutesOfDay(ist('2026-11-23T05:30:00'))).toBe(330);
    expect(istMinutesOfDay(ist('2026-11-23T00:00:00'))).toBe(0);
  });

  it('addDays across months and leap years', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('isoWeekday and weekStart (Monday)', () => {
    expect(isoWeekday('2026-11-23')).toBe(1); // Monday
    expect(isoWeekday('2026-11-29')).toBe(7); // Sunday
    expect(weekStart('2026-11-29')).toBe('2026-11-23');
    expect(weekStart('2026-11-23')).toBe('2026-11-23');
    expect(weekStart('2026-11-25')).toBe('2026-11-23');
  });

  it('daysBetween', () => {
    expect(daysBetween('2026-11-01', '2026-11-23')).toBe(22);
    expect(daysBetween('2026-11-23', '2026-11-20')).toBe(-3);
  });

  it('parseDate validates', () => {
    expect(parseDate('2026-11-23').getUTCDate()).toBe(23);
    expect(() => parseDate('2026-02-30')).toThrow('Invalid date');
    expect(() => parseDate('23/11/2026')).toThrow('Invalid date');
  });
});

describe('logicalMoment', () => {
  it('IST plan time on a logical day; before 03:00 is the next calendar night', () => {
    expect(new Date(logicalMoment('2026-11-23', '05:30')).toISOString()).toBe(
      '2026-11-23T00:00:00.000Z',
    );
    expect(new Date(logicalMoment('2026-11-23', '02:00:00')).toISOString()).toBe(
      '2026-11-23T20:30:00.000Z',
    );
    expect(() => logicalMoment('2026-11-23', '5:30')).toThrow();
  });
});
