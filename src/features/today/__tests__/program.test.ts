import {
  canMoveToTomorrow,
  moveSummary,
  planMoveToTomorrow,
  type ProgramCtx,
  sessionFor,
} from '../lib/program';

const days = [
  { id: 'd1', weekday: 1, title: 'Upper A', kind: 'strength' },
  { id: 'd2', weekday: 2, title: 'Lower A', kind: 'strength' },
  { id: 'd3', weekday: 3, title: 'Walk', kind: 'walk' },
  { id: 'd4', weekday: 4, title: 'Upper B', kind: 'strength' },
  { id: 'd5', weekday: 5, title: 'Lower B', kind: 'strength' },
  { id: 'd6', weekday: 6, title: 'Full Body Circuit', kind: 'circuit' },
  { id: 'd7', weekday: 7, title: 'Rest', kind: 'rest' },
];
const ctx: ProgramCtx = { program: { start_date: '2026-11-23' }, days, overrides: [] };
const MON = '2026-11-23';

describe('sessionFor', () => {
  it('weekday rule, overrides, program start', () => {
    expect(sessionFor(MON, ctx)?.title).toBe('Upper A');
    expect(sessionFor('2026-11-29', ctx)?.kind).toBe('rest');
    expect(sessionFor('2026-11-22', ctx)).toBeNull(); // before start
    expect(sessionFor(MON, { ...ctx, program: null })).toBeNull();
    expect(sessionFor(MON, { ...ctx, program: { start_date: null } })?.id).toBe('d1');
    const moved = { ...ctx, overrides: [{ client_id: 'o', date: MON, workout_day_id: 'd2' }] };
    expect(sessionFor(MON, moved)?.title).toBe('Lower A');
    expect(
      sessionFor(MON, { ...moved, overrides: [{ ...moved.overrides[0]!, deleted_at: 'x' }] })?.id,
    ).toBe('d1');
  });
});

describe('Move to tomorrow (DESIGN_NOTES A17)', () => {
  it('Monday: every later day shifts by one; Sunday rest absorbs it', () => {
    const changes = planMoveToTomorrow(MON, ctx);
    expect(
      changes.map((c) => (c.op === 'upsert' ? [c.row.date, c.row.workout_day_id] : null)),
    ).toEqual([
      ['2026-11-24', 'd1'],
      ['2026-11-25', 'd2'],
      ['2026-11-26', 'd3'],
      ['2026-11-27', 'd4'],
      ['2026-11-28', 'd5'],
      ['2026-11-29', 'd6'],
    ]);
    expect(moveSummary(MON, ctx)).toBe('Upper A moves to Tue, Lower A shifts to Wed');
  });

  it('Saturday: only Sunday changes; reuses an existing override row', () => {
    const sat = '2026-11-28';
    const withRow = {
      ...ctx,
      overrides: [{ client_id: 'sun', date: '2026-11-29', workout_day_id: 'd7' }],
    };
    expect(planMoveToTomorrow(sat, withRow)).toEqual([
      {
        op: 'upsert',
        table: 'session_override',
        clientId: 'sun',
        row: { date: '2026-11-29', workout_day_id: 'd6', deleted_at: null },
      },
    ]);
    expect(moveSummary(sat, ctx)).toBe('Full Body Circuit moves to Sun');
  });

  it('not offered on Sunday, rest days or without a program', () => {
    expect(canMoveToTomorrow('2026-11-29', ctx)).toBe(false);
    expect(planMoveToTomorrow('2026-11-29', ctx)).toEqual([]);
    expect(canMoveToTomorrow(MON, { ...ctx, program: null })).toBe(false);
    expect(moveSummary(MON, { ...ctx, program: null })).toBe('');
  });

  it('a day already showing the shifted session is left alone', () => {
    const already = { ...ctx, days: days.map((d) => (d.weekday === 2 ? { ...d, id: 'd1' } : d)) };
    expect(planMoveToTomorrow(MON, already)[0]).toMatchObject({ row: { date: '2026-11-25' } });
  });
});
