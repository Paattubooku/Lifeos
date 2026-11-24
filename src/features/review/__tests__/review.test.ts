import {
  changeIdeas,
  gradeFor,
  pinnedChange,
  planReview,
  type PlannedDay,
  type ReviewRow,
  reviewWeek,
  summaryFrom,
  weekDays,
  weekLabel,
  worstBlock,
} from '../lib/review';

const MON = '2026-11-23';
const SUN = '2026-11-29';

describe('which week', () => {
  it('Sunday reviews this week; other days last week', () => {
    expect(reviewWeek(SUN)).toBe(MON);
    expect(reviewWeek('2026-11-30')).toBe(MON);
    expect(reviewWeek('2026-11-25')).toBe('2026-11-16');
    expect(weekDays(MON, '2026-11-25')).toEqual([MON, '2026-11-24', '2026-11-25']);
    expect(weekDays(MON, SUN)).toHaveLength(7);
    expect(weekLabel('2026-12-21')).toBe('Week 52');
    expect(weekLabel('2026-01-05')).toBe('Week 2');
  });

  it('grade bands (A5)', () => {
    expect(gradeFor(90)?.grade).toBe('Excellent');
    expect(gradeFor(89)).toEqual({ grade: 'Good', band: '80–89%' });
    expect(gradeFor(70)?.grade).toBe('OK');
    expect(gradeFor(69)?.grade).toBe('Needs work');
    expect(gradeFor(null)).toBeNull();
  });
});

describe('summary from v_weekly_rollup', () => {
  it('maps the row and last week’s score; numeric strings; missing week', () => {
    const rows = [
      {
        week_start: MON,
        avg_score: 81,
        streak_days: 5,
        sessions: 4,
        avg_protein: '148.4',
        avg_kcal: 2040,
        weight_change: '-0.54',
        avg_sleep_hours: '6.8',
        spend_inr: '6420.00',
      },
      {
        week_start: '2026-11-16',
        avg_score: 76,
        streak_days: 3,
        sessions: 3,
        avg_protein: null,
        avg_kcal: null,
        weight_change: null,
        avg_sleep_hours: null,
        spend_inr: '0',
      },
    ];
    expect(summaryFrom(rows, MON, null)).toEqual({
      avgScore: 81,
      prevScore: 76,
      streakDays: 5,
      sessions: 4,
      avgProtein: 148.4,
      avgKcal: 2040,
      weightChange: -0.5,
      avgSleep: 6.8,
      spend: 6420,
      worst: null,
    });
    expect(summaryFrom([], MON, null)).toMatchObject({
      avgScore: null,
      streakDays: 0,
      spend: 0,
      weightChange: null,
    });
  });
});

describe('worst block', () => {
  const walk = (id: string) => ({
    id,
    title: 'Evening walk',
    start_time: '18:30:00',
    auto_complete: false,
  });
  const pack = { id: 'p', title: 'Pack lunch', start_time: '07:30:00', auto_complete: false };
  const water = { id: 'w', title: 'Drink 500 ml', start_time: '05:10:00', auto_complete: true };
  const days: PlannedDay[] = [
    { date: '2026-11-23', blocks: [walk('w1'), pack, water] },
    { date: '2026-11-24', blocks: [walk('w1'), pack, water] },
    { date: '2026-11-28', blocks: [walk('w2')] }, // weekend template, same title
  ];
  it('lowest completion over the week, matched by title, auto blocks left out', () => {
    const done = new Set(['2026-11-23:p', '2026-11-28:w2']);
    expect(worstBlock(days, done)).toEqual({
      title: 'Evening walk',
      startTime: '18:30:00',
      done: 1,
      scheduled: 3,
      pct: 33,
      missed: ['2026-11-23', '2026-11-24'],
    });
  });
  it('nothing missed → null; ties prefer more scheduled days', () => {
    const all = new Set([
      '2026-11-23:p',
      '2026-11-24:p',
      '2026-11-23:w1',
      '2026-11-24:w1',
      '2026-11-28:w2',
    ]);
    expect(worstBlock(days, all)).toBeNull();
    expect(worstBlock(days, new Set())!.title).toBe('Evening walk');
    expect(worstBlock([], new Set())).toBeNull();
  });
});

describe('saving and pinning', () => {
  const summary = summaryFrom(
    [
      {
        week_start: MON,
        avg_score: 81,
        streak_days: 5,
        sessions: 4,
        avg_protein: null,
        avg_kcal: null,
        weight_change: null,
        avg_sleep_hours: null,
        spend_inr: 0,
      },
    ],
    MON,
    null,
  );
  it('one row per week, reused', () => {
    expect(planReview(MON, null, summary, ' Packed lunch ', '')).toEqual([
      {
        op: 'upsert',
        table: 'weekly_review',
        row: {
          week_start: MON,
          summary,
          grade: 'Good',
          went_well: 'Packed lunch',
          change_next_week: null,
          deleted_at: null,
        },
      },
    ]);
    expect(planReview(MON, { client_id: 'r1' }, summary, 'x'.repeat(400), 'y')[0]).toMatchObject({
      clientId: 'r1',
      row: { went_well: 'x'.repeat(280) },
    });
  });

  it('the change shows all next week (from Monday), not before or after', () => {
    const reviews: ReviewRow[] = [
      {
        client_id: 'r',
        week_start: MON,
        went_well: null,
        change_next_week: 'Walk after dinner',
        grade: 'Good',
        summary: {},
      },
    ];
    expect(pinnedChange(reviews, SUN)).toBeNull();
    expect(pinnedChange(reviews, '2026-11-30')?.text).toBe('Walk after dinner');
    expect(pinnedChange(reviews, '2026-12-06')?.text).toBe('Walk after dinner');
    expect(pinnedChange(reviews, '2026-12-07')).toBeNull();
    expect(pinnedChange([{ ...reviews[0]!, change_next_week: null }], '2026-11-30')).toBeNull();
    expect(pinnedChange([{ ...reviews[0]!, deleted_at: 'x' }], '2026-11-30')).toBeNull();
  });
});

describe('change ideas', () => {
  const base = summaryFrom([], MON, null);
  it('from the worst block, sleep and protein', () => {
    const t = { proteinG: 150, sleepH: 7, phoneOff: '9:30 pm' };
    expect(changeIdeas(base, t)).toEqual(['Same plan, no skips']);
    expect(
      changeIdeas(
        {
          ...base,
          avgSleep: 6.5,
          avgProtein: 120,
          worst: {
            title: 'Evening walk',
            startTime: '18:30',
            done: 1,
            scheduled: 7,
            pct: 14,
            missed: [],
          },
        },
        t,
      ),
    ).toEqual(['Evening walk every day', 'Phone in the hall at 9:30 pm', 'Protein at every meal']);
    expect(changeIdeas({ ...base, avgSleep: 7.5, avgProtein: 160 }, t)).toEqual([
      'Same plan, no skips',
    ]);
  });
});
