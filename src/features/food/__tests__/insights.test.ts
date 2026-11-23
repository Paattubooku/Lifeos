import { insights, topInsights } from '../lib/insights';

const base = {
  kcal: 1200,
  protein: 120,
  carbs: 100, // 400 kcal = 33 %
  fat: 30, // 270 kcal = 22.5 %
  kcalTarget: 2200,
  proteinTarget: 150,
  nowMin: 14 * 60,
  dinnerMin: 20 * 60,
};
const ids = (over: object) => insights({ ...base, ...over }).map((i) => i.id);

describe('F08 AC4: every insight threshold', () => {
  it('kcal over target (danger): 2,201 yes, 2,200 no', () => {
    expect(ids({ kcal: 2201, carbs: 0, fat: 0 })).toContain('kcal-over');
    expect(ids({ kcal: 2200, carbs: 0, fat: 0 })).not.toContain('kcal-over');
    expect(insights({ ...base, kcal: 2300, carbs: 0, fat: 0 })[0]).toEqual({
      id: 'kcal-over',
      tone: 'danger',
      text: '100 kcal over today’s target.',
    });
  });

  it('within 200 kcal of target before dinner (warning)', () => {
    expect(ids({ kcal: 2000, carbs: 0, fat: 0 })).toContain('kcal-near');
    expect(ids({ kcal: 1999, carbs: 0, fat: 0 })).not.toContain('kcal-near');
    expect(ids({ kcal: 2100, carbs: 0, fat: 0, nowMin: 20 * 60 })).not.toContain('kcal-near');
  });

  it('protein < 70 % of target after 16:30 (warning, suggests foods)', () => {
    expect(ids({ protein: 104, nowMin: 16 * 60 + 30 })).toContain('protein-low');
    expect(ids({ protein: 105, nowMin: 16 * 60 + 30 })).not.toContain('protein-low');
    expect(ids({ protein: 10, nowMin: 16 * 60 + 29 })).not.toContain('protein-low');
    expect(ids({ protein: 0, proteinTarget: 0, nowMin: 17 * 60 })).not.toContain('protein-low');
    expect(insights({ ...base, protein: 98, nowMin: 17 * 60 })[0]).toMatchObject({
      text: 'Protein 65% of target: add eggs, chicken, paneer or sundal.',
      action: 'protein',
    });
  });

  it('carbs > 55 % of kcal (info)', () => {
    expect(ids({ kcal: 1000, carbs: 138, fat: 0 })).toContain('carbs-high'); // 55.2 %
    expect(ids({ kcal: 1000, carbs: 137.5, fat: 0 })).not.toContain('carbs-high'); // 55 %
  });

  it('fat > 35 % (warning)', () => {
    expect(ids({ kcal: 900, fat: 35.1, carbs: 0 })).toContain('fat-high'); // 35.1 %
    expect(ids({ kcal: 900, fat: 35, carbs: 0 })).not.toContain('fat-high'); // 35 %
  });

  it('macros are skipped until 200 kcal', () => {
    expect(ids({ kcal: 200, carbs: 50, fat: 20 })).toEqual([]);
  });

  it('at most 2 chips, most serious first', () => {
    const all = { kcal: 2500, protein: 10, carbs: 400, fat: 120, nowMin: 17 * 60 };
    expect(ids(all)).toEqual(['kcal-over', 'protein-low', 'fat-high', 'carbs-high']);
    expect(topInsights({ ...base, ...all }).map((i) => i.id)).toEqual(['kcal-over', 'protein-low']);
  });
});
