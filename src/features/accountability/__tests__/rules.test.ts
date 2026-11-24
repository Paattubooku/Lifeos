import {
  auditDay,
  easiest,
  fallback,
  INTERRUPT_MAX,
  interrupt,
  nextInterruptAt,
  type NudgeRow,
  type NudgeRowInput,
  pinnedFor,
  planNudge,
  realityWeight,
  recovery,
  rescuesOn,
  strictWeek,
  withRescues,
} from '../lib/rules';

const TODAY = '2026-11-24';
const at = (h: number, m = 0) => h * 60 + m;
const nudge = (kind: string, date = TODAY, over: Partial<NudgeRow> = {}): NudgeRow => ({
  client_id: `${kind}-${date}-${Math.random()}`,
  date,
  kind,
  ref: null,
  shown_at: 'x',
  dismissed_at: null,
  ...over,
});
const row = (
  id: string,
  title: string,
  start: string,
  dur: number,
  state: NudgeRowInput['state'],
  kind = 'custom',
  optional = false,
): NudgeRowInput => ({
  block: {
    id,
    client_id: `c-${id}`,
    title,
    kind,
    start_time: `${start}:00`,
    duration_min: dur,
    is_optional: optional,
  },
  state,
  log: null,
});
const DAY = [
  row('w', 'Wake', '05:00', 10, 'done', 'wake'),
  row('d', 'Drink 500 ml', '05:10', 10, 'overdue', 'water'),
  row('wo', 'Workout · Upper A', '05:30', 50, 'overdue', 'workout'),
  row('p', 'Pack lunch', '07:30', 15, 'overdue'),
  row('o', 'Evening walk', '18:30', 30, 'upcoming', 'custom', true),
  row('l', 'Lunch', '13:00', 30, 'upcoming', 'meal'),
  row('t', 'Water target', '21:00', 10, 'upcoming', 'water'),
  row('z', 'Lights out', '22:00', 10, 'upcoming', 'sleep'),
];

describe('missed-day recovery', () => {
  const base = {
    enabled: true,
    missedTitles: ['Workout · Upper A', 'Dinner'],
    today: DAY,
    nudges: [],
    date: TODAY,
  };
  it('shows when yesterday < 70, offers missed blocks then key blocks (max 4)', () => {
    const r = recovery({ ...base, yesterdayScore: 54 });
    expect(r.show).toBe(true);
    expect(r.options.map((o) => o.title)).toEqual([
      'Workout · Upper A',
      'Water target',
      'Lights out',
    ]);
  });
  it('not after a streak day, when off, or once dismissed / locked in today', () => {
    expect(recovery({ ...base, yesterdayScore: 70 }).show).toBe(false);
    expect(recovery({ ...base, yesterdayScore: null }).show).toBe(false);
    expect(recovery({ ...base, enabled: false, yesterdayScore: 40 }).show).toBe(false);
    expect(
      recovery({
        ...base,
        yesterdayScore: 40,
        nudges: [nudge('missed_day', TODAY, { dismissed_at: 'x' })],
      }).show,
    ).toBe(false);
    expect(
      recovery({ ...base, yesterdayScore: 40, nudges: [nudge('pinned', TODAY, { ref: 'c-wo' })] })
        .show,
    ).toBe(false);
    // yesterday's dismissal doesn't count today
    expect(
      recovery({
        ...base,
        yesterdayScore: 40,
        nudges: [nudge('missed_day', '2026-11-23', { dismissed_at: 'x' })],
      }).show,
    ).toBe(true);
    expect(
      pinnedFor(
        [nudge('pinned', TODAY, { ref: 'a' }), nudge('pinned', TODAY, { ref: 'b' })],
        TODAY,
      ),
    ).toBe('b');
    expect(pinnedFor([], TODAY)).toBeNull();
  });
});

describe('failure interrupt (A8)', () => {
  const base = {
    enabled: true,
    rows: DAY,
    nudges: [] as NudgeRow[],
    date: TODAY,
    now: 1000,
    snoozedUntil: null,
  };
  it('≥ 3 counted overdue → show, easiest first (a water drink)', () => {
    const r = interrupt(base);
    expect(r).toMatchObject({ show: true, overdue: 3, isNew: true });
    expect(r.target?.block.title).toBe('Drink 500 ml');
    expect(easiest(DAY.filter((x) => x.block.kind !== 'water'))?.block.title).toBe('Pack lunch');
  });
  it('2 overdue, snoozed, off → no', () => {
    expect(interrupt({ ...base, rows: DAY.filter((r) => r.block.id !== 'p') }).show).toBe(false);
    expect(interrupt({ ...base, snoozedUntil: 2000 }).show).toBe(false);
    expect(interrupt({ ...base, snoozedUntil: 500 }).show).toBe(true);
    expect(interrupt({ ...base, enabled: false }).show).toBe(false);
  });
  it('max 3 a day; an open (undismissed) showing keeps showing', () => {
    const three = [1, 2, 3].map(() => nudge('interrupt', TODAY, { dismissed_at: 'x' }));
    expect(interrupt({ ...base, nudges: three }).show).toBe(false);
    expect(
      interrupt({ ...base, nudges: [...three.slice(0, 2), nudge('interrupt')] }),
    ).toMatchObject({ show: true, isNew: false });
    expect(INTERRUPT_MAX).toBe(3);
  });
  it('notification time: first block start where 3 would be overdue', () => {
    const fresh = DAY.map((r) =>
      r.state === 'overdue' ? { ...r, state: 'upcoming' as const } : r,
    );
    // drink ends 05:20, workout 06:20, pack 07:45 → 3 overdue by the 13:00 lunch start
    expect(
      nextInterruptAt({
        enabled: true,
        rows: fresh,
        nowMin: at(5),
        shownToday: 0,
        snoozedUntilMin: null,
      }),
    ).toBe(at(13));
    expect(
      nextInterruptAt({
        enabled: true,
        rows: fresh,
        nowMin: at(5),
        shownToday: 3,
        snoozedUntilMin: null,
      }),
    ).toBeNull();
    expect(
      nextInterruptAt({
        enabled: false,
        rows: fresh,
        nowMin: at(5),
        shownToday: 0,
        snoozedUntilMin: null,
      }),
    ).toBeNull();
    expect(
      nextInterruptAt({
        enabled: true,
        rows: fresh,
        nowMin: at(5),
        shownToday: 0,
        snoozedUntilMin: at(18),
      }),
    ).toBe(at(18, 30));
    expect(
      nextInterruptAt({
        enabled: true,
        rows: DAY.slice(0, 2),
        nowMin: at(5),
        shownToday: 0,
        snoozedUntilMin: null,
      }),
    ).toBeNull();
  });
});

describe('fallback mode (A9): computed gains', () => {
  const base = {
    enabled: true,
    nowMin: at(19, 10),
    done: 4,
    counted: 11,
    nudges: [] as NudgeRow[],
    date: TODAY,
    graceAvailable: true,
  };
  it('after 18:00 below 50 %; each action’s real gain; all four lift to grace', () => {
    const f = fallback(base);
    expect(f.show).toBe(true);
    expect(f.score).toBe(36);
    expect(f.actions.map((a) => a.gain)).toEqual([6, 6, 6, 6]);
    expect(f.allTo).toBe(53);
    expect(f.saves).toBe('grace');
    expect(fallback({ ...base, graceAvailable: false }).saves).toBe('no');
    expect(fallback({ ...base, done: 7, counted: 10 }).show).toBe(false);
    expect(fallback({ ...base, nowMin: at(17, 59) }).show).toBe(false);
    expect(fallback({ ...base, enabled: false }).show).toBe(false);
  });
  it('done actions count, stay shown, and lower the remaining gains', () => {
    const f = fallback({
      ...base,
      nudges: [nudge('rescue_eggs'), nudge('rescue_water'), nudge('rescue_eggs', '2026-11-23')],
    });
    expect(f.score).toBe(46);
    expect(f.actions.find((a) => a.kind === 'rescue_eggs')).toMatchObject({ done: true, gain: 0 });
    expect(f.actions.find((a) => a.kind === 'rescue_walk')?.gain).toBe(4);
    expect(rescuesOn([nudge('rescue_eggs'), nudge('rescue_eggs')], TODAY)).toBe(1);
    expect(fallback({ ...base, done: 2, counted: 3 }).saves).toBe('streak');
    expect(withRescues(0, 0, 0)).toBe(100);
  });
});

describe('reality check (A10) and audit day', () => {
  const avg7 = [
    { date: '2026-11-13', avg7: 88.4 },
    { date: '2026-11-18', avg7: 88.7 },
    { date: '2026-11-23', avg7: 89.0 },
  ];
  const scores = Array.from({ length: 12 }, (_, i) => ({
    date: `2026-11-${String(12 + i).padStart(2, '0')}`,
    score: 84,
  }));
  const intake = new Map(scores.map((s) => [s.date, 1800]));
  const base = {
    enabled: true,
    today: TODAY,
    avg7,
    scores,
    intake,
    tdee: 2280,
    nudges: [] as NudgeRow[],
  };
  it('weight up ≥ 0.4 over 10–14 days with ≥ 75 % days and ≥ 300 kcal deficit', () => {
    expect(realityWeight(base)).toEqual({
      show: true,
      days: 10,
      from: 88.4,
      to: 89.0,
      gain: 0.6,
      avgScore: 84,
      deficit: 480,
    });
    expect(realityWeight({ ...base, tdee: 2050 })?.show).toBe(false);
    expect(realityWeight({ ...base, scores: scores.map((s) => ({ ...s, score: 70 })) })?.show).toBe(
      false,
    );
    expect(
      realityWeight({ ...base, avg7: [avg7[0]!, { date: '2026-11-23', avg7: 88.7 }] })?.show,
    ).toBe(false);
    expect(realityWeight({ ...base, avg7: avg7.slice(1) })).toBeNull();
    expect(realityWeight({ ...base, avg7: avg7.slice(0, 2) })).toBeNull();
    expect(realityWeight({ ...base, enabled: false })?.show).toBe(false);
  });
  it('once per 7 days after acting on it; strict week lasts 7 days', () => {
    const acted = [nudge('reality_weight', '2026-11-20', { dismissed_at: 'x' })];
    expect(realityWeight({ ...base, nudges: acted })?.show).toBe(false);
    expect(
      realityWeight({
        ...base,
        nudges: [nudge('reality_weight', '2026-11-17', { dismissed_at: 'x' })],
      })?.show,
    ).toBe(true);
    expect(strictWeek([nudge('strict_week', '2026-11-18')], TODAY)).toBe(true);
    expect(strictWeek([nudge('strict_week', '2026-11-17')], TODAY)).toBe(false);
  });
  it('audit day after 7 straight days at 100 %, once per 7 days', () => {
    const perfect = Array.from({ length: 7 }, (_, i) => ({
      date: `2026-11-${String(17 + i)}`,
      score: 100,
    }));
    expect(auditDay({ enabled: true, today: TODAY, scores: perfect, nudges: [] })).toBe(true);
    expect(auditDay({ enabled: true, today: TODAY, scores: perfect.slice(1), nudges: [] })).toBe(
      false,
    );
    expect(
      auditDay({
        enabled: true,
        today: TODAY,
        scores: perfect,
        nudges: [nudge('reality_audit', '2026-11-22', { dismissed_at: 'x' })],
      }),
    ).toBe(false);
    expect(auditDay({ enabled: false, today: TODAY, scores: perfect, nudges: [] })).toBe(false);
  });
  it('nudge rows', () => {
    expect(planNudge(TODAY, 'pinned', Date.parse('2026-11-24T00:00:00Z'), { ref: 'c-1' })).toEqual([
      {
        op: 'upsert',
        table: 'nudge_log',
        row: {
          date: TODAY,
          kind: 'pinned',
          ref: 'c-1',
          shown_at: '2026-11-24T00:00:00.000Z',
          dismissed_at: null,
        },
      },
    ]);
    expect(planNudge(TODAY, 'interrupt', 0, { dismissed: true, clientId: 'n' })[0]).toMatchObject({
      clientId: 'n',
      row: { dismissed_at: '1970-01-01T00:00:00.000Z' },
    });
  });
});
