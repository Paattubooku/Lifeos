import {
  avgLogged,
  dailyNutrition,
  lastDates,
  pctChange,
  waterDays,
  weeklySessions,
} from '../lib/progress';

const TUE = '2026-11-24';

describe('progress lib', () => {
  it('last dates', () => {
    expect(lastDates(TUE, 3)).toEqual(['2026-11-22', '2026-11-23', TUE]);
  });

  it('daily nutrition: food + coffee, deleted ignored, unlogged days null', () => {
    const n = dailyNutrition(
      [
        { date: TUE, kcal: 500, protein_g: 30 },
        { date: TUE, kcal: '250.4', protein_g: '10.2' },
        { date: '2026-11-23', kcal: 900, protein_g: 40, deleted_at: 'x' },
        { date: '2026-11-22', kcal: null, protein_g: null },
      ],
      [{ date: TUE }, { date: '2026-11-21' }, { date: '2026-11-21', deleted_at: 'x' }],
      TUE,
    );
    expect(n.kcal).toHaveLength(14);
    expect(n.kcal.slice(-4).map((d) => d.value)).toEqual([20, 0, null, 770]);
    expect(n.protein.slice(-4).map((d) => d.value)).toEqual([0, 0, null, 40]);
  });

  it('average of logged days', () => {
    const v = [
      { date: 'a', value: 100 },
      { date: 'b', value: null },
      { date: 'c', value: 201 },
      { date: 'd', value: 999 },
    ];
    expect(avgLogged(v, 7)).toBe(433);
    expect(avgLogged(v, 7, true)).toBe(151);
    expect(avgLogged([{ date: 'a', value: null }])).toBeNull();
  });

  it('sessions per week: ≥ 80 %, not deleted, this week last', () => {
    const w = weeklySessions(
      [
        { date: TUE, completion: 100 },
        { date: '2026-11-23', completion: 80 },
        { date: '2026-11-22', completion: 79 },
        { date: '2026-11-20', completion: 90 },
        { date: '2026-11-19', completion: 100, deleted_at: 'x' },
        { date: '2026-09-01', completion: 100 },
      ],
      TUE,
    );
    expect(w).toHaveLength(8);
    expect(w.at(-1)).toEqual({ week: '2026-11-23', done: 2 });
    expect(w.at(-2)).toEqual({ week: '2026-11-16', done: 1 });
    expect(w[0]!.week).toBe('2026-10-05');
    expect(w.reduce((s, x) => s + x.done, 0)).toBe(3);
  });

  it('water: 14 days, 7-day avg and hits exclude today', () => {
    const totals = new Map([
      [TUE, 3500],
      ['2026-11-23', 3000],
      ['2026-11-22', 2000],
      ['2026-11-21', 0],
      ['2026-11-16', 3200],
      ['2026-11-10', 3200],
    ]);
    const w = waterDays(totals, TUE, 3000);
    expect(w.days).toHaveLength(14);
    expect(w.days.at(-4)?.value).toBeNull();
    expect(w.avg7).toBe(2500);
    expect(w.hit7).toBe(1);
    expect(waterDays(new Map(), TUE, 3000)).toMatchObject({ avg7: null, hit7: 0 });
  });

  it('pct change', () => {
    expect(pctChange(108, 100)).toBe(8);
    expect(pctChange(5, 0)).toBeNull();
  });
});
