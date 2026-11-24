import { draftSummary, newDraft, planDayEdit, toDraft, validate } from '../lib/editor';
import type { WorkoutItem } from '../lib/program';

const item = (n: number, over: Partial<WorkoutItem> = {}): WorkoutItem => ({
  id: `i${n}`,
  client_id: `c${n}`,
  workout_day_id: 'd1',
  exercise_id: `e${n}`,
  sets: 3,
  rep_min: 8,
  rep_max: 12,
  duration_sec: null,
  rest_sec: 90,
  sort: n,
  ...over,
});
const ORIGINAL = [
  item(0),
  item(1),
  item(2, { duration_sec: 30, rep_min: 30, rep_max: 45, rest_sec: 120 }),
];

describe('program editor (F23)', () => {
  it('unchanged → no writes', () => {
    expect(planDayEdit('d1', ORIGINAL, toDraft(ORIGINAL))).toEqual([]);
  });

  it('edit sets/reps/rest, swap an exercise, reorder, remove, add from the library', () => {
    const d = toDraft(ORIGINAL);
    d[0] = { ...d[0]!, sets: 4, rest_sec: 60 };
    d[1] = { ...d[1]!, exercise_id: 'e9' };
    const removed = d.splice(2, 1);
    expect(removed[0]!.key).toBe('c2');
    d.unshift(newDraft('e7', { clientId: 'n1', id: 'nid1' }));
    expect(planDayEdit('d1', ORIGINAL, d)).toEqual([
      { op: 'delete', table: 'workout_exercise', clientId: 'c2' },
      {
        op: 'upsert',
        table: 'workout_exercise',
        clientId: 'n1',
        row: {
          id: 'nid1',
          workout_day_id: 'd1',
          exercise_id: 'e7',
          sets: 3,
          rep_min: 8,
          rep_max: 12,
          duration_sec: null,
          rest_sec: 90,
          sort: 0,
          deleted_at: null,
        },
      },
      {
        op: 'upsert',
        table: 'workout_exercise',
        clientId: 'c0',
        row: { sets: 4, rest_sec: 60, sort: 1 },
      },
      {
        op: 'upsert',
        table: 'workout_exercise',
        clientId: 'c1',
        row: { exercise_id: 'e9', sort: 2 },
      },
    ]);
  });

  it('validation and summaries', () => {
    const d = toDraft(ORIGINAL);
    expect(validate(d).size).toBe(0);
    expect(validate([{ ...d[0]!, sets: 0 }]).get('c0')).toBe('Sets must be 1–10.');
    expect(validate([{ ...d[0]!, rep_min: 13 }]).get('c0')).toMatch(/low end/);
    expect(validate([{ ...d[0]!, rest_sec: 700 }]).get('c0')).toMatch(/Rest/);
    expect(draftSummary(d[0]!)).toBe('3 × 8–12 · rest 90 s');
    expect(draftSummary(d[2]!)).toBe('3 × 30 s · rest 120 s');
    expect(draftSummary({ ...d[0]!, rep_min: null, rep_max: null })).toBe('3 × max · rest 90 s');
    expect(draftSummary({ ...d[0]!, rep_min: 10, rep_max: 10 })).toBe('3 × 10 · rest 90 s');
    expect(toDraft([{ ...item(5), client_id: undefined, deleted_at: null }])[0]!.key).toBe('i5');
    expect(toDraft([item(6, { deleted_at: 'x' })])).toEqual([]);
  });
});
