/**
 * Daily food insights (PRD F08), ported from Food-Tracker `api/insights.js`
 * to pure on-device rules with the PRD's thresholds (no AI).
 */

export type InsightTone = 'danger' | 'warning' | 'info';
export type Insight = { id: string; tone: InsightTone; text: string; action?: 'protein' };

export type InsightInput = {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  kcalTarget: number;
  proteinTarget: number;
  /** Minutes on the logical day. */
  nowMin: number;
  /** Dinner time (minutes); before it, "close to target" warns. */
  dinnerMin: number;
};

export const NEAR_TARGET_KCAL = 200;
export const PROTEIN_LOW_SHARE = 0.7;
export const PROTEIN_CHECK_MIN = 16 * 60 + 30;
export const CARB_HIGH_SHARE = 0.55;
export const FAT_HIGH_SHARE = 0.35;
/** Macro balance is noise before a real meal (reference: > 200 kcal). */
export const MACRO_MIN_KCAL = 200;
export const MAX_CHIPS = 2;

const RANK: Record<InsightTone, number> = { danger: 0, warning: 1, info: 2 };

export function insights(i: InsightInput): Insight[] {
  const out: Insight[] = [];
  const over = i.kcal - i.kcalTarget;
  if (over > 0) {
    out.push({
      id: 'kcal-over',
      tone: 'danger',
      text: `${Math.round(over)} kcal over today’s target.`,
    });
  } else if (i.nowMin < i.dinnerMin && i.kcalTarget - i.kcal <= NEAR_TARGET_KCAL) {
    out.push({
      id: 'kcal-near',
      tone: 'warning',
      text: `Only ${Math.round(i.kcalTarget - i.kcal)} kcal left before dinner.`,
    });
  }
  if (
    i.nowMin >= PROTEIN_CHECK_MIN &&
    i.proteinTarget > 0 &&
    i.protein < i.proteinTarget * PROTEIN_LOW_SHARE
  ) {
    const pct = Math.round((i.protein / i.proteinTarget) * 100);
    out.push({
      id: 'protein-low',
      tone: 'warning',
      text: `Protein ${pct}% of target: add eggs, chicken, paneer or sundal.`,
      action: 'protein',
    });
  }
  if (i.kcal > MACRO_MIN_KCAL) {
    const carbShare = (i.carbs * 4) / i.kcal;
    const fatShare = (i.fat * 9) / i.kcal;
    if (fatShare > FAT_HIGH_SHARE)
      out.push({
        id: 'fat-high',
        tone: 'warning',
        text: `${Math.round(fatShare * 100)}% of calories from fat. Go easy on oil.`,
      });
    if (carbShare > CARB_HIGH_SHARE)
      out.push({
        id: 'carbs-high',
        tone: 'info',
        text: `${Math.round(carbShare * 100)}% of calories from carbs. Add protein or vegetables.`,
      });
  }
  return out.sort((a, b) => RANK[a.tone] - RANK[b.tone]);
}

/** At most 2 chips under the totals bar, most serious first. */
export const topInsights = (i: InsightInput) => insights(i).slice(0, MAX_CHIPS);
