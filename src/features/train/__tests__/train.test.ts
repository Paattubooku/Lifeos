import {
  estMinutes,
  isBodyweight,
  isTimed,
  itemsOf,
  plannedSets,
  shortName,
  targetReps,
  targetText,
  weightStep,
  type WorkoutItem,
} from '../lib/program';
import {
  circuitPosition,
  completion,
  currentIndex,
  lastTime,
  planFinish,
  planLogSet,
  planStartSession,
  planWalkDone,
  prefill,
  type SessionRow,
  type SetLogRow,
  setsOf,
  setsText,
  volume,
} from '../lib/session';
import { lastSevenDays, thisWeek, weekSummary } from '../lib/week';

const item = (
  id: string,
  sets: number,
  rmin: number | null,
  rmax: number | null,
  rest = 90,
  dur: number | null = null,
  sort = 0,
): WorkoutItem => ({
  id: `wi-${id}`,
  workout_day_id: 'd1',
  exercise_id: id,
  sets,
  rep_min: rmin,
  rep_max: rmax,
  duration_sec: dur,
  rest_sec: rest,
  sort,
});
const UPPER_A = [
  item('bench', 4, 8, 12, 90, null, 0),
  item('row', 4, 8, 12, 75, null, 1),
  item('press', 3, 8, 12, 75, null, 2),
  item('curl', 3, 10, 15, 60, null, 3),
  item('triceps', 3, 10, 15, 60, null, 4),
];
const session: SessionRow = {
  id: 's1',
  client_id: 's1-c',
  date: '2026-11-23',
  workout_day_id: 'd1',
  started_at: '2026-11-23T00:01:00Z',
  finished_at: null,
  completion: 0,
};
const log = (
  ex: string,
  no: number,
  w: number | null,
  reps: number | null,
  date = '2026-11-23',
  sid = 's1',
  dur: number | null = null,
): SetLogRow => ({
  client_id: `${sid}-${ex}-${no}-${date}`,
  session_id: sid,
  date,
  exercise_id: ex,
  set_no: no,
  weight_kg: w,
  reps,
  duration_sec: dur,
});

describe('program helpers', () => {
  it('weight steps: 0.5 kg below 10 kg, 1 kg from 10', () => {
    expect(weightStep(9.5, 1)).toBe(0.5);
    expect(weightStep(10, 1)).toBe(1);
    expect(weightStep(10, -1)).toBe(0.5);
    expect(weightStep(11, -1)).toBe(1);
  });

  it('targets and estimates', () => {
    expect(targetText(UPPER_A[0]!)).toBe('4 × 8–12');
    expect(targetText(UPPER_A[1]!, { unilateral: true })).toBe('4 × 8–12 / side');
    expect(targetText(item('pu', 3, null, null))).toBe('3 × max');
    expect(targetText(item('lunge', 3, 10, 10))).toBe('3 × 10');
    expect(targetText(item('plank', 3, 30, 45, 45, 45))).toBe('3 × 30–45 s');
    expect(targetText(item('walk', 1, null, null, 0, 1800))).toBe('1 × 1800 s');
    expect(targetReps(item('pu', 3, null, null))).toBe(10);
    expect(isTimed(item('plank', 3, 30, 45, 45, 45))).toBe(true);
    expect(isBodyweight({ equipment: 'bodyweight' })).toBe(true);
    expect(isBodyweight(undefined)).toBe(true);
    expect(isBodyweight({ equipment: 'dumbbells' })).toBe(false);
    expect(plannedSets(UPPER_A)).toBe(17);
    expect(estMinutes(UPPER_A)).toBe(30);
    expect(estMinutes([item('walk', 1, null, null, 0, 1800)])).toBe(30);
    expect(shortName('DB bench press')).toBe('Bench');
    expect(shortName('Goblet squat')).toBe('Goblet squat');
    expect(itemsOf([...UPPER_A].reverse(), 'd1').map((i) => i.exercise_id)[0]).toBe('bench');
  });
});

describe('F11 AC1: logging a set pre-fills the next set with the same weight/reps', () => {
  it('this session first, then last time’s same set, then the plan', () => {
    const bench = UPPER_A[0]!;
    const last = [
      log('bench', 1, 14, 12, '2026-11-16', 's0'),
      log('bench', 2, 14, 11, '2026-11-16', 's0'),
    ];
    expect(prefill(bench, [], null)).toEqual({ weight: 0, reps: 8, duration: 12, source: 'plan' });
    expect(prefill(bench, [], last)).toMatchObject({ weight: 14, reps: 12, source: 'last' });
    expect(prefill(bench, [log('bench', 1, 15, 10)], last)).toMatchObject({
      weight: 15,
      reps: 10,
      source: 'this',
    });
    expect(
      prefill(
        bench,
        [log('bench', 1, 15, 10), log('bench', 2, 15, 9), log('bench', 3, 15, 8)],
        last,
      ),
    ).toMatchObject({ reps: 8, source: 'this' });
    // last time had fewer sets: falls back to its last set
    expect(prefill(bench, [], last.slice(0, 1))).toMatchObject({ weight: 14, source: 'last' });
    const plank = item('plank', 3, 30, 45, 45, 45);
    expect(
      prefill(plank, [log('plank', 1, null, null, '2026-11-23', 's1', 42)], null),
    ).toMatchObject({ duration: 42 });
  });

  it('lastTime finds the latest earlier day', () => {
    const logs = [
      log('bench', 1, 12, 12, '2026-11-09', 'a'),
      log('bench', 1, 14, 12, '2026-11-16', 'b'),
      log('bench', 1, 15, 12, '2026-11-23'),
    ];
    expect(lastTime(logs, 'bench', '2026-11-23')?.date).toBe('2026-11-16');
    expect(lastTime(logs, 'row', '2026-11-23')).toBeNull();
  });
});

describe('completion and progress', () => {
  it('logged ÷ planned sets, extras capped; current exercise; volume', () => {
    const logs = [
      log('bench', 1, 14, 12),
      log('bench', 2, 14, 11),
      log('bench', 3, 14, 10),
      log('bench', 4, 14, 9),
      log('bench', 5, 14, 8),
      log('row', 1, 16, 12),
    ];
    expect(completion(UPPER_A, logs, 's1')).toBe(Math.round((5 / 17) * 100));
    expect(currentIndex(UPPER_A, logs, 's1')).toBe(1);
    expect(currentIndex(UPPER_A.slice(0, 1), logs, 's1')).toBe(-1);
    expect(volume(logs)).toBe(14 * (12 + 11 + 10 + 9 + 8) + 16 * 12);
    expect(completion([], logs, 's1')).toBe(0);
    // a re-logged set replaces the earlier one
    expect(
      setsOf([...logs, { ...log('bench', 1, 15, 12), client_id: 'again' }], 's1', 'bench')[0]
        ?.weight_kg,
    ).toBe(15);
  });

  it('F11 AC3 support: logging keeps session completion current (14 of 17 sets = 82 %)', () => {
    const logs: SetLogRow[] = [];
    for (const i of UPPER_A)
      for (let n = 1; n <= i.sets; n++) logs.push(log(i.exercise_id, n, 10, 10));
    const almost = logs.slice(0, 13);
    const changes = planLogSet(
      { session, items: UPPER_A, logs: almost, date: '2026-11-23' },
      { exerciseId: 'triceps', setNo: 2, weight: 8, reps: 12, duration: null },
    );
    expect(changes[0]).toMatchObject({
      table: 'set_log',
      row: { session_id: 's1', exercise_id: 'triceps', set_no: 2, weight_kg: 8, reps: 12 },
    });
    expect(changes[1]).toEqual({
      op: 'upsert',
      table: 'session_log',
      clientId: 's1-c',
      row: { completion: 82 },
    });
    // re-log reuses the row
    expect(
      planLogSet(
        { session, items: UPPER_A, logs: almost, date: '2026-11-23' },
        { exerciseId: 'bench', setNo: 1, weight: 15, reps: 12, duration: null },
      )[0],
    ).toMatchObject({ clientId: almost[0]!.client_id });
    expect(planFinish(session, UPPER_A, logs, 0)[0]).toMatchObject({
      row: { completion: 100, finished_at: new Date(0).toISOString() },
    });
  });

  it('circuit rounds × stations', () => {
    const c = [
      item('thr', 4, 10, 10, 0, null, 0),
      item('ren', 4, 8, 8, 0, null, 1),
      item('lun', 4, 12, 12, 60, null, 2),
    ];
    expect(circuitPosition(c, [], 's1')).toEqual({ round: 1, rounds: 4, station: 0, done: false });
    const r1 = [
      log('thr', 1, 8, 10),
      log('ren', 1, 10, 8),
      log('lun', 1, 6, 12),
      log('thr', 2, 8, 10),
    ];
    expect(circuitPosition(c, r1, 's1')).toEqual({ round: 2, rounds: 4, station: 1, done: false });
    const all = c.flatMap((i) => [1, 2, 3, 4].map((n) => log(i.exercise_id, n, 8, 10)));
    expect(circuitPosition(c, all, 's1').done).toBe(true);
    expect(circuitPosition([], [], 's1').done).toBe(true);
  });

  it('start, walk done, set text', () => {
    expect(planStartSession('2026-11-23', 'd1', null, { sessionId: 'new' }, 0)).toMatchObject({
      sessionId: 'new',
      changes: [{ row: { id: 'new', completion: 0 } }],
    });
    expect(planStartSession('2026-11-23', 'd1', session, { sessionId: 'x' }, 0)).toEqual({
      sessionId: 's1',
      changes: [],
    });
    expect(
      planStartSession('2026-11-23', 'd1', { ...session, started_at: null }, { sessionId: 'x' }, 0)
        .changes[0],
    ).toMatchObject({ clientId: 's1-c' });
    expect(
      planStartSession('2026-11-23', 'd1', { ...session, deleted_at: 'x' }, { sessionId: 'x' }, 0),
    ).toMatchObject({
      sessionId: 's1',
      changes: [{ clientId: 's1-c', row: { deleted_at: null } }],
    });
    expect(planWalkDone('2026-11-25', 'd3', null, 'w', 0)[0]).toMatchObject({
      row: { id: 'w', completion: 100 },
    });
    expect(planWalkDone('2026-11-25', 'd3', session, 'w', 0)[0]).toMatchObject({
      clientId: 's1-c',
      row: { started_at: session.started_at },
    });
    expect(
      setsText([
        log('b', 1, 14, 12),
        log('p', 1, null, null, '2026-11-23', 's1', 42),
        log('pu', 1, 0, 15),
      ]),
    ).toBe('14×12 · 42 s · 15');
  });
});

describe('week strip', () => {
  const days = [
    ['d1', 1, 'Upper A', 'strength'],
    ['d2', 2, 'Lower A', 'strength'],
    ['d3', 3, 'Walk', 'walk'],
    ['d4', 4, 'Upper B', 'strength'],
    ['d5', 5, 'Lower B', 'strength'],
    ['d6', 6, 'Full Body Circuit', 'circuit'],
    ['d7', 7, 'Rest', 'rest'],
  ].map(([id, weekday, title, kind]) => ({
    id: id as string,
    weekday: weekday as number,
    title: title as string,
    kind: kind as string,
  }));
  const ctx = { program: { start_date: '2026-11-02' }, days, overrides: [] };
  const done = (date: string, completion: number): SessionRow => ({
    ...session,
    id: date,
    client_id: date,
    date,
    completion,
  });

  it('last 7 days: done / missed / rest / today; summary', () => {
    const week = lastSevenDays('2026-11-23', ctx, [
      done('2026-11-17', 90),
      done('2026-11-18', 100),
      done('2026-11-20', 85),
      done('2026-11-21', 79),
    ]);
    expect(week.map((d) => [d.title, d.state])).toEqual([
      ['Lower A', 'done'],
      ['Walk', 'done'],
      ['Upper B', 'missed'],
      ['Lower B', 'done'],
      ['Full Body Circuit', 'missed'],
      ['Rest', 'rest'],
      ['Upper A', 'today'],
    ]);
    expect(weekSummary(week)).toMatchObject({ done: 3, planned: 6 });
    expect(weekSummary(week).missed.map((d) => d.title)).toEqual(['Upper B', 'Full Body Circuit']);
  });

  it('this week Mon–Sun; before the program starts there is nothing', () => {
    expect(thisWeek('2026-11-25', ctx, []).map((d) => d.state)).toEqual([
      'missed',
      'missed',
      'today',
      'upcoming',
      'upcoming',
      'upcoming',
      'rest',
    ]);
    expect(
      lastSevenDays('2026-11-23', { ...ctx, program: { start_date: '2026-12-07' } }, [])[0],
    ).toMatchObject({ state: 'none', title: '—' });
  });
});
