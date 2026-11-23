import type { WorkoutItem } from '../lib/program';
import {
  changePct,
  epley,
  exerciseHistory,
  suggestNext,
  suggestionReason,
  TEMPO_CUE,
} from '../lib/overload';
import type { SetLogRow } from '../lib/session';

const item = (over: Partial<WorkoutItem> = {}): WorkoutItem => ({
  id: 'wi',
  workout_day_id: 'd1',
  exercise_id: 'bench',
  sets: 3,
  rep_min: 8,
  rep_max: 12,
  duration_sec: null,
  rest_sec: 90,
  sort: 0,
  ...over,
});
const sets = (weight: number | null, ...reps: number[]): SetLogRow[] =>
  reps.map((r, i) => ({
    client_id: `s${i}`,
    session_id: 'x',
    date: '2026-11-16',
    exercise_id: 'bench',
    set_no: i + 1,
    weight_kg: weight,
    reps: r,
    duration_sec: null,
  }));

describe('F12 AC: every rule branch', () => {
  it('every working set hit rep_max → +1 kg (≥ 10 kg)', () => {
    expect(suggestNext(item(), sets(14, 12, 12, 12))).toEqual({
      kind: 'add_weight',
      weight: 15,
      from: 14,
      text: 'Try 15 kg',
    });
  });

  it('… +0.5 kg under 10 kg; 9.5 → 10', () => {
    expect(suggestNext(item(), sets(8, 12, 13, 12))).toMatchObject({
      kind: 'add_weight',
      weight: 8.5,
    });
    expect(suggestNext(item(), sets(9.5, 12, 12, 12))).toMatchObject({ weight: 10 });
  });

  it('… never past the 20 kg cap: 19.5 → 20', () => {
    expect(suggestNext(item(), sets(19.5, 12, 12, 12))).toMatchObject({
      kind: 'add_weight',
      weight: 20,
    });
  });

  it('20 kg cap reached → +1 rep target past rep_max and a slow-lowering cue', () => {
    expect(suggestNext(item(), sets(20, 12, 12, 12))).toEqual({
      kind: 'add_rep',
      reps: 13,
      weight: 20,
      text: 'Try 13 reps',
      cue: TEMPO_CUE,
    });
  });

  it('bodyweight at the top of the range → +1 rep', () => {
    expect(suggestNext(item({ rep_min: 10, rep_max: 10 }), sets(null, 10, 10, 10))).toMatchObject({
      kind: 'add_rep',
      reps: 11,
    });
  });

  it('≥ 2 sets missed rep_min → same weight; 1 miss → nothing', () => {
    expect(suggestNext(item(), sets(14, 9, 7, 6))).toEqual({
      kind: 'same',
      weight: 14,
      text: 'Stay at 14 kg',
    });
    expect(suggestNext(item(), sets(0, 9, 7, 6))).toMatchObject({ text: 'Same again' });
    expect(suggestNext(item(), sets(14, 10, 9, 7))).toBeNull();
  });

  it('in range but not all at the top → nothing; missing sets don’t count as hitting it', () => {
    expect(suggestNext(item(), sets(14, 12, 11, 12))).toBeNull();
    expect(suggestNext(item(), sets(14, 12, 12))).toBeNull(); // only 2 of 3 sets logged
  });

  it('no history, timed exercises, max-rep sets, duration-only logs → nothing', () => {
    expect(suggestNext(item(), null)).toBeNull();
    expect(suggestNext(item(), [])).toBeNull();
    expect(suggestNext(item({ duration_sec: 45 }), sets(0, 45, 45, 45))).toBeNull();
    expect(suggestNext(item({ rep_min: null, rep_max: null }), sets(0, 20, 18, 15))).toBeNull();
    expect(
      suggestNext(
        item(),
        sets(14, 12).map((s) => ({ ...s, reps: null, duration_sec: 40 })),
      ),
    ).toBeNull();
  });

  it('reasons', () => {
    const i = item();
    expect(suggestionReason(suggestNext(i, sets(14, 12, 12, 12))!, i)).toBe(
      'Every set hit 12 last time at 14 kg.',
    );
    expect(suggestionReason(suggestNext(i, sets(20, 12, 12, 12))!, i)).toBe(
      'Every set hit 12 at 20 kg (the cap). Slow 3-second lowering.',
    );
    expect(suggestionReason(suggestNext(i, sets(null, 12, 12, 12))!, i)).toMatch(/bodyweight/);
    expect(suggestionReason(suggestNext(i, sets(14, 7, 7, 9))!, i)).toBe(
      '2+ sets missed 8 last time.',
    );
  });
});

describe('history', () => {
  const log = (date: string, no: number, w: number, reps: number, ex = 'bench'): SetLogRow => ({
    client_id: `${date}-${no}-${ex}`,
    session_id: date,
    date,
    exercise_id: ex,
    set_no: no,
    weight_kg: w,
    reps,
    duration_sec: null,
  });

  it('Epley', () => {
    expect(epley(15, 10)).toBe(20);
    expect(epley(0, 10)).toBe(0);
    expect(epley(10, 0)).toBe(0);
  });

  it('one row per day, newest first, best set by est. 1RM, volume; 8-week change', () => {
    const logs = [
      log('2026-09-28', 1, 10, 12),
      log('2026-09-28', 2, 10, 10),
      log('2026-11-23', 2, 15, 10),
      log('2026-11-23', 1, 14, 12),
      log('2026-11-23', 3, 15, 9),
      log('2026-11-16', 1, 14, 12),
      log('2026-11-16', 2, 14, 11),
      log('2026-11-23', 1, 30, 1, 'row'),
      { ...log('2026-11-02', 1, 13, 12), deleted_at: 'x' },
    ];
    const h = exerciseHistory(logs, 'bench');
    expect(h.map((r) => r.date)).toEqual(['2026-11-23', '2026-11-16', '2026-09-28']);
    expect(h[0]).toMatchObject({ e1rm: 20, volume: 14 * 12 + 15 * 10 + 15 * 9 });
    expect(h[0]!.best).toMatchObject({ weight_kg: 15, reps: 10 });
    expect(h[0]!.sets.map((s) => s.set_no)).toEqual([1, 2, 3]);
    expect(changePct(h, '2026-11-23', '2026-09-28')).toBe(43);
    expect(changePct(h, '2026-11-23', '2026-11-20')).toBeNull();
    // ties go to more reps
    expect(exerciseHistory([log('d', 1, 0, 10), log('d', 2, 0, 12)], 'bench')[0]!.best.reps).toBe(
      12,
    );
  });
});
