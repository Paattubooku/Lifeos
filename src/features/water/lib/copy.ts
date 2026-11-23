import { formatClock, formatIndianNumber } from '@/lib/format';

import type { Pace } from './pace';

const ml = (n: number) => `${formatIndianNumber(n)} ml`;

/** Smallest gap worth a banner / one-tap catch-up (the suggestion floor). */
export const BANNER_GAP_ML = 50;

export function showBehind(p: Pace): boolean {
  return p.status === 'behind' && p.gap >= BANNER_GAP_ML;
}

/** The one line under the water bar (Today + Water designs). */
export function paceLine(
  p: Pace,
  ctx: {
    totalMl: number;
    targetMl: number;
    targetTime: string;
    wakeTime: string;
    beforeWake: boolean;
  },
): { text: string; tone: 'danger' | 'success' | 'secondary' } {
  switch (p.status) {
    case 'goal_reached':
      return { text: `Goal hit · ${ml(ctx.totalMl)} today.`, tone: 'success' };
    case 'sleeping':
      return ctx.beforeWake
        ? { text: `Pace starts at ${formatClock(ctx.wakeTime)}.`, tone: 'secondary' }
        : { text: `${ml(ctx.totalMl)} today. Pace is off for the night.`, tone: 'secondary' };
    default:
      // A few ml behind counts as on pace.
      if (showBehind(p))
        return { text: `${ml(p.gap)} behind. Drink ${ml(p.suggested)} now.`, tone: 'danger' };
      return {
        text: `On pace. ${ml(Math.max(0, ctx.targetMl - ctx.totalMl))} left by ${formatClock(ctx.targetTime)}.`,
        tone: 'secondary',
      };
  }
}
