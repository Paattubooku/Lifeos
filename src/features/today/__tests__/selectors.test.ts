import { blocksOf } from '@/features/routine/lib/blocks';
import { seedRoutine } from '@/test/routineFixtures';

import { type AutoInputs, autoStatus, drinkAmount, reachedAt } from '../lib/auto';
import {
  blockState,
  currentBlock,
  endOf,
  formatMinutes,
  nextBlock,
  nowDayMinutes,
} from '../lib/timeline';
import { type BlockLogLike, buildDay, computeScore, logsByBlock, openRows } from '../selectors';

const { blocks } = seedRoutine();
const workday = blocksOf(blocks, 'workday');
const byTitle = (t: string) => workday.find((b) => b.title === t)!;

/** IST wall clock on Mon 23 Nov 2026 → epoch ms. */
const at = (hhmm: string, day = 23) => Date.parse(`2026-11-${day}T${hhmm}:00+05:30`);

const NONE: AutoInputs = { water: [], waterTargetMl: 3000, eatenSlots: new Set(), session: null };

describe('timeline', () => {
  it('nowDayMinutes keeps 00:00–02:59 on the previous logical day', () => {
    expect(nowDayMinutes(at('05:20'))).toBe(320);
    expect(nowDayMinutes(at('01:30', 24))).toBe(1440 + 90);
    expect(nowDayMinutes(at('03:00', 24))).toBe(180);
  });

  it('blockState: upcoming → current → due → overdue; done/skipped win', () => {
    const lunch = byTitle('Lunch'); // 13:00, 30 min
    const s = (t: string) => blockState(lunch, { nowMin: nowDayMinutes(at(t)) });
    expect(s('12:59')).toBe('upcoming');
    expect(s('13:00')).toBe('current');
    expect(s('13:29')).toBe('current');
    expect(s('13:30')).toBe('due');
    expect(s('13:59')).toBe('due');
    expect(s('14:00')).toBe('overdue');
    expect(blockState(lunch, { nowMin: 0, status: 'done' })).toBe('done');
    expect(blockState(lunch, { nowMin: 2000, autoDone: true })).toBe('done');
    expect(blockState(lunch, { nowMin: 2000, status: 'skipped' })).toBe('skipped');
    expect(endOf({ start_time: '22:00:00', duration_min: 0 })).toBe(1321);
  });

  it('formatMinutes', () => {
    expect(formatMinutes(25)).toBe('25 min');
    expect(formatMinutes(65)).toBe('1 h 5 min');
    expect(formatMinutes(120)).toBe('2 h');
    expect(formatMinutes(-3)).toBe('0 min');
  });
});

describe('F05 AC3: the current block at any time of day', () => {
  const current = (t: string, day = 23, logs: BlockLogLike[] = []) => {
    const d = buildDay(workday, logs, NONE, nowDayMinutes(at(t, day)));
    return d.current?.block.title ?? null;
  };

  it.each([
    ['04:59', null],
    ['05:00', 'Wake up'],
    ['05:09', 'Wake up'],
    ['05:10', 'Drink 500 ml water'],
    ['05:29', 'Drink 500 ml water'],
    ['05:30', 'Workout'], // overlaps the drink window: the later start wins
    ['06:29', 'Workout'],
    ['06:30', null],
    ['13:15', 'Lunch'],
    ['18:45', 'Evening walk'],
    ['21:30', 'Phone away'],
    ['22:10', 'Lights out'],
    ['22:15', null],
  ])('%s → %s', (t, title) => {
    expect(current(t)).toBe(title);
  });

  it('after midnight it is still the previous logical day (nothing current)', () => {
    expect(current('01:00', 24)).toBeNull();
  });

  it('a done block is not current; the overlapped one takes over', () => {
    const workout = byTitle('Workout');
    const drink = byTitle('Drink 500 ml water');
    const log: BlockLogLike = { client_id: 'l', block_id: workout.id, status: 'done' };
    expect(current('05:35', 23, [log])).toBe(drink.title);
  });

  it('currentBlock / nextBlock directly', () => {
    expect(currentBlock(workday, new Map())).toBeNull();
    expect(nextBlock(workday, nowDayMinutes(at('13:15')))?.title).toBe('Snack');
    expect(nextBlock(workday, nowDayMinutes(at('23:00')))).toBeNull();
  });
});

describe('auto-complete rules', () => {
  const drink = byTitle('Drink 500 ml water');
  const target = byTitle('Water target hit');

  it('drinkAmount / reachedAt', () => {
    expect(drinkAmount('Drink 500 ml water')).toBe(500);
    expect(drinkAmount('Drink 1,000ml')).toBe(1000);
    expect(drinkAmount('Water')).toBe(500);
    const entries = [
      { amount_ml: 300, logged_at: '2026-11-22T23:50:00Z' },
      { amount_ml: 200, logged_at: '2026-11-22T23:40:00Z' },
    ];
    expect(reachedAt(entries, 500)).toBe(Date.parse('2026-11-22T23:50:00Z'));
    expect(reachedAt(entries, 501)).toBeNull();
  });

  it('F05 AC2: 500 ml logged at 05:15 auto-completes "Drink 500 ml water"', () => {
    const inputs = {
      ...NONE,
      water: [{ amount_ml: 500, logged_at: new Date(at('05:15')).toISOString() }],
    };
    expect(autoStatus(drink, workday, NONE)).toEqual({
      done: false,
      at: null,
      hint: 'auto: 500 ml',
    });
    expect(autoStatus(drink, workday, inputs)).toEqual({
      done: true,
      at: at('05:15'),
      hint: 'auto: 500 ml at 5:15 am',
    });
    const day = buildDay(workday, [], inputs, nowDayMinutes(at('05:16')));
    expect(day.rows.find((r) => r.block.id === drink.id)?.state).toBe('done');
    expect(day.score).toEqual({ done: 1, counted: 11, score: 9 });
  });

  it('water target: total ≥ target', () => {
    expect(autoStatus(target, workday, NONE)).toMatchObject({
      done: false,
      hint: '3,000 ml by 9:00 pm',
    });
    const water = [1000, 1000, 1000].map((ml, i) => ({
      amount_ml: ml,
      logged_at: new Date(at(`1${i}:00`)).toISOString(),
    }));
    expect(autoStatus(target, workday, { ...NONE, water }).done).toBe(true);
  });

  it('meal: anything eaten in the slot', () => {
    const lunch = byTitle('Lunch');
    expect(autoStatus(lunch, workday, NONE)).toMatchObject({
      done: false,
      hint: 'auto: when logged',
    });
    expect(autoStatus(lunch, workday, { ...NONE, eatenSlots: new Set(['lunch']) }).done).toBe(true);
    expect(autoStatus({ ...lunch, ref_slot: null }, workday, NONE).done).toBe(false);
  });

  it('workout: ≥ 80 % or a rest day; nothing without a program', () => {
    const w = byTitle('Workout');
    expect(autoStatus(w, workday, NONE)).toEqual({ done: false, at: null, hint: null });
    expect(
      autoStatus(w, workday, { ...NONE, session: { kind: 'strength', completion: 79 } }).done,
    ).toBe(false);
    expect(
      autoStatus(w, workday, { ...NONE, session: { kind: 'strength', completion: 80 } }).done,
    ).toBe(true);
    expect(
      autoStatus(w, workday, { ...NONE, session: { kind: 'strength', completion: null } }).hint,
    ).toBe('auto: session 80%+');
    expect(
      autoStatus(w, workday, { ...NONE, session: { kind: 'rest', completion: null } }),
    ).toMatchObject({
      done: true,
      hint: 'Rest day — nothing to do',
    });
  });

  it('manual blocks never auto-complete', () => {
    expect(autoStatus(byTitle('Wake up'), workday, NONE).hint).toBeNull();
    expect(
      autoStatus({ ...drink, auto_complete: false }, workday, { ...NONE, water: [] }).done,
    ).toBe(false);
  });
});

describe('computeScore (PRD §4.2)', () => {
  const auto = { done: false, at: null, hint: null };
  const rows = workday.map((block) => ({ block, log: null as BlockLogLike | null, auto }));

  it('optional blocks are ignored; empty plan = 100', () => {
    expect(computeScore(rows)).toEqual({ done: 0, counted: 11, score: 0 });
    expect(computeScore([])).toEqual({ done: 0, counted: 0, score: 100 });
    const walkDone = rows.map((r) =>
      r.block.is_optional
        ? { ...r, log: { client_id: 'x', block_id: r.block.id, status: 'done' } }
        : r,
    );
    expect(computeScore(walkDone).done).toBe(0);
  });

  it('skipped with a reason leaves the denominator; without a reason it counts as missed', () => {
    const skip = (reason: string | null) =>
      rows.map((r, i) =>
        i === 2
          ? {
              ...r,
              log: { client_id: 's', block_id: r.block.id, status: 'skipped', skip_reason: reason },
            }
          : r,
      );
    expect(computeScore(skip('sick')).counted).toBe(10);
    expect(computeScore(skip(null)).counted).toBe(11);
  });

  it('ticked and auto-done blocks both count; rounding', () => {
    const mixed = rows.map((r, i) =>
      i === 0
        ? { ...r, log: { client_id: 'd', block_id: r.block.id, status: 'done' } }
        : i === 1
          ? { ...r, auto: { ...auto, done: true } }
          : r,
    );
    expect(computeScore(mixed)).toEqual({ done: 2, counted: 11, score: 18 });
  });

  it('logsByBlock ignores deleted rows; openRows lists what is left', () => {
    const map = logsByBlock([
      { client_id: 'a', block_id: 'b1', status: 'done', deleted_at: 'x' },
      { client_id: 'b', block_id: 'b2', status: 'done' },
    ]);
    expect([...map.keys()]).toEqual(['b2']);
    const day = buildDay(
      workday,
      [{ client_id: 'w', block_id: workday[0]!.id, status: 'done' }],
      NONE,
      nowDayMinutes(at('21:30')),
    );
    expect(openRows(day.rows)).toHaveLength(10);
  });
});
