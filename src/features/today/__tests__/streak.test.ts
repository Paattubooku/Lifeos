import { addDays } from '@/lib/dates';

import {
  averageScore,
  blockStreak,
  classifyScore,
  computeStreak,
  type DayScore,
  heatBand,
  heatmap,
  isStreakDay,
  lastBreak,
  streakLine,
} from '../lib/streak';

const TODAY = '2026-12-27';
/** Scores for consecutive days ending yesterday. */
const days = (...scores: (number | null)[]): DayScore[] =>
  scores.map((score, i) => ({ date: addDays(TODAY, i - scores.length), score }));
const streak = (ds: DayScore[], todayScore: number | null = null) =>
  computeStreak(ds, TODAY, todayScore);

describe('classifyScore boundaries (PRD §4.2)', () => {
  it('69 vs 70, 49 vs 50, missing', () => {
    expect(classifyScore(70)).toBe('streak');
    expect(classifyScore(69)).toBe('grace');
    expect(classifyScore(50)).toBe('grace');
    expect(classifyScore(49)).toBe('break');
    expect(classifyScore(null)).toBe('break');
    expect(classifyScore(undefined)).toBe('break');
    expect(isStreakDay(100)).toBe(true);
    expect(isStreakDay(69)).toBe(false);
  });
});

describe('computeStreak (PRD §4.3, F06 AC)', () => {
  it('perfect days count up; best has its range', () => {
    const s = streak(days(100, 100, 100));
    expect(s.current).toBe(3);
    expect(s.since).toBe('2026-12-24');
    expect(s.best).toEqual({ length: 3, from: '2026-12-24', to: '2026-12-26' });
  });

  it('70 keeps it, 69 needs grace; 49 breaks, 50 can be graced', () => {
    expect(streak(days(80, 70)).current).toBe(2);
    expect(streak(days(80, 69)).current).toBe(2); // first grace
    expect(streak(days(80, 50)).current).toBe(2);
    expect(streak(days(80, 49)).current).toBe(0);
  });

  it('a grace day keeps the streak; a second within 14 days breaks it', () => {
    const s = streak(days(80, 60, 80, 80, 60, 80));
    expect(s.current).toBe(1); // second grace 3 days later broke the run
    expect(s.graceDays).toEqual(['2026-12-22']);
    expect(s.best?.length).toBe(4);
  });

  it('a grace day 15 days after the last one is allowed, 14 is not', () => {
    const fifteen = days(80, 60, ...Array<number>(14).fill(80), 60, 80);
    expect(streak(fifteen).current).toBe(18);
    expect(streak(fifteen).graceDays).toHaveLength(2);
    const fourteen = days(80, 60, ...Array<number>(13).fill(80), 60, 80);
    expect(streak(fourteen).current).toBe(1);
  });

  it('< 50 breaks; a missing day_log breaks', () => {
    expect(streak(days(90, 40, 90)).current).toBe(1);
    const gap = [...days(90, 90, 90).slice(0, 1), ...days(90).map((d) => d)]; // 2026-12-23 and 2026-12-26
    expect(streak(gap).current).toBe(1);
    expect(streak(days(90, null, 90)).current).toBe(1);
  });

  it('optional/excused blocks are the score’s concern; deleted day_logs count as missing', () => {
    const ds = days(90, 90);
    expect(streak([...ds.slice(0, 1), { ...ds[1]!, deleted_at: 'x' }]).current).toBe(0);
  });

  it('today never breaks the streak; ≥ 70 today adds to it', () => {
    expect(streak(days(90, 90), 10).current).toBe(2);
    expect(streak(days(90, 90), 60).current).toBe(2);
    expect(streak(days(90, 90), 70).current).toBe(3);
    expect(streak([], 75)).toMatchObject({ current: 1, since: TODAY, best: { length: 1 } });
    expect(streak([], null)).toMatchObject({ current: 0, since: null, best: null });
  });

  it('a grace-eligible day never starts a run', () => {
    expect(streak(days(40, 60, 80)).current).toBe(1);
  });

  it('grace availability and the line', () => {
    const used = streak(days(80, 60, 80));
    expect(used.graceAvailable).toBe(false);
    expect(streakLine(used, (d) => `on ${d}`)).toBe('3-day streak · grace used on 2026-12-25');
    const free = streak(days(80));
    expect(streakLine(free, String)).toBe('1-day streak · 1 grace left');
    // Exactly 15 days later grace is available again.
    const old = computeStreak([{ date: '2026-12-12', score: 60 }], TODAY, null);
    expect(old.graceAvailable).toBe(true);
    expect(streakLine({ ...free, current: 0 }, String)).toBe('0-day streak · 1 grace left');
  });
});

describe('heatmap and helpers', () => {
  it('bands', () => {
    expect([null, 44, 58, 72, 85, 90].map(heatBand)).toEqual([
      'none',
      'lt50',
      '50to69',
      '70to79',
      '80to89',
      '90plus',
    ]);
  });

  it('30 cells ending today, today live, grace marked', () => {
    const cells = heatmap(days(80, 60, 80), TODAY, 45, ['2026-12-25'], 30);
    expect(cells).toHaveLength(30);
    expect(cells[0]?.date).toBe('2026-11-28');
    expect(cells.at(-1)).toEqual({
      date: TODAY,
      score: 45,
      band: 'lt50',
      grace: false,
      today: true,
    });
    expect(cells.at(-3)).toMatchObject({ date: '2026-12-25', grace: true, band: '50to69' });
    expect(cells[0]?.band).toBe('none');
    expect(averageScore(cells)).toBe(66);
    expect(averageScore([])).toBeNull();
  });

  it('lastBreak', () => {
    expect(lastBreak(days(44, 90, 30, 90), TODAY)).toEqual({ date: '2026-12-25', score: 30 });
    expect(lastBreak(days(90), TODAY)).toBeNull();
  });

  it('blockStreak counts back from today if done, else yesterday', () => {
    const done = new Set(['2026-12-24', '2026-12-25', '2026-12-26']);
    expect(blockStreak(done, TODAY)).toBe(3);
    expect(blockStreak(new Set([...done, TODAY]), TODAY)).toBe(4);
    expect(blockStreak(new Set(['2026-12-25']), TODAY)).toBe(0);
  });
});
