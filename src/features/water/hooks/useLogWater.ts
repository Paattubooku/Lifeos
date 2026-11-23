import { queueSoftDelete, queueUpsert } from '@/features/sync/slice';
import type { DateString } from '@/lib/dates';
import { formatIndianNumber } from '@/lib/format';
import { useAppDispatch, useAppSelector } from '@/store';
import { waterGoalCelebrated } from '@/store/appSlice';
import { haptics, useSnackbar } from '@/ui';

import { validateAmount } from '../lib/pace';

/** Event-time clock (kept out of render for the React Compiler). */
const clock = () => Date.now();

export type WaterEntry = {
  client_id: string;
  date: DateString;
  amount_ml: number;
  logged_at: string;
};

/**
 * Log / delete water with an Undo snackbar. Crossing the target fires a success
 * haptic + toast once per logical day (PRD F07 AC4).
 */
export function useLogWater() {
  const dispatch = useAppDispatch();
  const showSnackbar = useSnackbar();
  const celebrated = useAppSelector((s) => s.app.waterGoalCelebrated ?? null);

  const log = async (
    ml: number,
    ctx: { today: DateString; totalBefore: number; targetMl: number },
  ): Promise<string | null> => {
    const error = validateAmount(ml);
    if (error) return error;
    const res = await dispatch(
      queueUpsert({
        table: 'water_log',
        row: { date: ctx.today, amount_ml: ml, logged_at: new Date(clock()).toISOString() },
      }),
    );
    const id = queueUpsert.fulfilled.match(res) ? res.payload : null;
    const undo = id
      ? {
          actionLabel: 'Undo',
          onAction: () => void dispatch(queueSoftDelete({ table: 'water_log', clientId: id })),
        }
      : {};
    const crossed = ctx.totalBefore < ctx.targetMl && ctx.totalBefore + ml >= ctx.targetMl;
    if (crossed && celebrated !== ctx.today) {
      haptics.success();
      dispatch(waterGoalCelebrated(ctx.today));
      showSnackbar({ message: `Water goal hit · ${formatIndianNumber(ctx.targetMl)} ml`, ...undo });
    } else {
      haptics.tap();
      showSnackbar({ message: `${formatIndianNumber(ml)} ml logged`, ...undo });
    }
    return null;
  };

  const remove = async (entry: WaterEntry) => {
    await dispatch(queueSoftDelete({ table: 'water_log', clientId: entry.client_id }));
    showSnackbar({
      message: `${formatIndianNumber(entry.amount_ml)} ml deleted`,
      actionLabel: 'Undo',
      onAction: () =>
        void dispatch(
          queueUpsert({
            table: 'water_log',
            clientId: entry.client_id,
            row: {
              date: entry.date,
              amount_ml: entry.amount_ml,
              logged_at: entry.logged_at,
              deleted_at: null,
            },
          }),
        ),
    });
  };

  return { log, remove };
}
