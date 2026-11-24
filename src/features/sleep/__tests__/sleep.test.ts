import { istClock } from '@/lib/dates';

import {
  bedOffset,
  bedtimeLine,
  clockOffset,
  offsetClock,
  durationText,
  hoursSlept,
  lastNights,
  morningCheck,
  nightDate,
  nightTimes,
  planNight,
  planPhoneOff,
  planWakeTick,
  type SleepRow,
  sleepStats,
  vsTarget,
  wokeOnTime,
} from '../lib/sleep';

const TUE = '2026-11-24';
const ist = (d: string, t: string) => new Date(`${d}T${t}:00+05:30`).toISOString();

describe('F14 AC1: bed 22:40, wake 05:05 → 6.4 h on the morning’s logical date', () => {
  it('hours, date and duration', () => {
    const bed = ist('2026-11-23', '22:40');
    const wake = ist(TUE, '05:05');
    expect(hoursSlept(bed, wake)).toBe(6.4);
    expect(nightDate(wake)).toBe(TUE);
    expect(durationText(bed, wake)).toBe('6 h 25 m');
    const t = nightTimes(TUE, '22:40', '05:05');
    expect(new Date(t.bedAt).toISOString()).toBe(bed);
    expect(new Date(t.wakeAt).toISOString()).toBe(wake);
    // after midnight bedtimes stay on the same night
    expect(istClock(nightTimes(TUE, '00:30', '05:05').bedAt)).toBe('00:30');
    expect(
      hoursSlept(nightTimes(TUE, '00:30', '05:05').bedAt, nightTimes(TUE, '00:30', '05:05').wakeAt),
    ).toBe(4.6);
  });

  it('planNight writes the morning’s row (reused when it exists)', () => {
    expect(planNight(TUE, null, '22:40', '05:05')).toEqual([
      {
        op: 'upsert',
        table: 'sleep_log',
        row: {
          date: TUE,
          bed_at: ist('2026-11-23', '22:40'),
          wake_at: ist(TUE, '05:05'),
          deleted_at: null,
        },
      },
    ]);
    const row: SleepRow = {
      client_id: 's',
      date: TUE,
      bed_at: null,
      wake_at: null,
      phone_off_kept: true,
    };
    expect(planNight(TUE, row, '22:00', '05:00')[0]).toMatchObject({ clientId: 's' });
  });
});

describe('F14 AC2: wake ≤ 05:15 ticks the Wake block', () => {
  it('within 15 min of wake time', () => {
    expect(wokeOnTime('05:15', '05:00')).toBe(true);
    expect(wokeOnTime('04:50', '05:00')).toBe(true);
    expect(wokeOnTime('05:16', '05:00')).toBe(false);
  });
});

describe('morning check and phone-off', () => {
  const profile = { wake_time: '05:00:00', sleep_time: '22:00:00' };
  it('from wake time until noon, until last night is logged; defaults bed / now', () => {
    expect(morningCheck(Date.parse(ist(TUE, '04:55')), TUE, profile, null)).toBeNull();
    expect(morningCheck(Date.parse(ist(TUE, '05:12')), TUE, profile, null)).toEqual({
      bed: '22:00',
      wake: '05:10',
    });
    expect(morningCheck(Date.parse(ist(TUE, '12:30')), TUE, profile, null)).toBeNull();
    const logged: SleepRow = {
      client_id: 's',
      date: TUE,
      bed_at: 'x',
      wake_at: 'y',
      phone_off_kept: null,
    };
    expect(morningCheck(Date.parse(ist(TUE, '06:00')), TUE, profile, logged)).toBeNull();
    // only the phone-off flag on the row: still ask
    expect(
      morningCheck(Date.parse(ist(TUE, '06:00')), TUE, profile, { ...logged, wake_at: null }),
    ).not.toBeNull();
  });

  it('ticking Phone away on day D marks the night ending D + 1', () => {
    expect(planPhoneOff('2026-11-23', null, true)).toEqual([
      {
        op: 'upsert',
        table: 'sleep_log',
        row: { date: TUE, phone_off_kept: true, deleted_at: null },
      },
    ]);
    expect(
      planPhoneOff(
        '2026-11-23',
        { client_id: 'n', date: TUE, bed_at: null, wake_at: null, phone_off_kept: true },
        false,
      )[0],
    ).toMatchObject({
      clientId: 'n',
      row: { phone_off_kept: false },
    });
  });
});

describe('14 nights', () => {
  const rows: SleepRow[] = [
    {
      client_id: 'a',
      date: TUE,
      bed_at: ist('2026-11-23', '22:40'),
      wake_at: ist(TUE, '05:05'),
      phone_off_kept: true,
    },
    {
      client_id: 'b',
      date: '2026-11-23',
      bed_at: ist('2026-11-22', '22:00'),
      wake_at: ist('2026-11-23', '05:00'),
      phone_off_kept: false,
    },
    {
      client_id: 'c',
      date: '2026-11-22',
      bed_at: ist('2026-11-22', '00:20'),
      wake_at: ist('2026-11-22', '05:20'),
      phone_off_kept: null,
    },
    {
      client_id: 'd',
      date: '2026-11-21',
      bed_at: null,
      wake_at: null,
      phone_off_kept: true,
      deleted_at: 'x',
    },
  ];
  it('nights, averages, target count, bedtime spread across midnight', () => {
    const nights = lastNights(rows, TUE);
    expect(nights).toHaveLength(14);
    expect(nights.slice(-3).map((n) => n.hours)).toEqual([5, 7, 6.4]);
    expect(nights[0]!.hours).toBeNull();
    expect(bedOffset(ist('2026-11-22', '00:20'))).toBe(380);
    const s = sleepStats(nights);
    expect(s).toMatchObject({ avg7: 6.1, atTarget: 1, logged: 3, phoneKept: 1, bedAvg: '23:00' });
    expect(s.bedSpread).toBe(59);
    expect(sleepStats(lastNights([], TUE))).toEqual({
      avg7: null,
      atTarget: 0,
      logged: 0,
      bedSpread: null,
      bedAvg: null,
      phoneKept: 0,
    });
  });
});

describe('wake tick and copy', () => {
  const wakeBlock = { id: 'w', start_time: '05:00:00' };
  it('ticks the Wake block only when on time and not already logged', () => {
    expect(planWakeTick(TUE, wakeBlock, null, '05:05', 1)).toEqual([
      expect.objectContaining({
        op: 'upsert',
        table: 'block_log',
        row: expect.objectContaining({ block_id: 'w', status: 'done', date: TUE }),
      }),
    ]);
    expect(planWakeTick(TUE, wakeBlock, null, '05:20', 1)).toEqual([]);
    expect(planWakeTick(TUE, undefined, null, '05:05', 1)).toEqual([]);
    expect(planWakeTick(TUE, wakeBlock, { client_id: 'l', deleted_at: null }, '05:05', 1)).toEqual(
      [],
    );
    expect(
      planWakeTick(TUE, wakeBlock, { client_id: 'l', deleted_at: 'x' }, '05:05', 1)[0],
    ).toMatchObject({ clientId: 'l' });
  });
  it('vs target', () => {
    expect(vsTarget('22:40', '22:00', '10:00 pm')).toBe('40 min after your 10:00 pm target');
    expect(vsTarget('21:50', '22:00', '10:00 pm')).toBe('10 min before your 10:00 pm target');
    expect(vsTarget('00:10', '22:00', '10:00 pm')).toBe('130 min after your 10:00 pm target');
    expect(vsTarget('22:00', '22:00', '10:00 pm')).toBe('on your 10:00 pm target');
  });
});

describe('bedtime copy', () => {
  it('offset clock and average line', () => {
    expect(offsetClock(280)).toBe('22:40');
    expect(offsetClock(380)).toBe('00:20');
    expect(clockOffset('22:00')).toBe(240);
    expect(bedtimeLine('22:32', '22:00', (t) => t)).toBe('Average bedtime 22:32, 32 min late.');
    expect(bedtimeLine('21:50', '22:00', (t) => t)).toBe('Average bedtime 21:50, 10 min early.');
    expect(bedtimeLine('22:00', '22:00', (t) => t)).toBe('Average bedtime 22:00, on time.');
  });
});
