import type { useToday } from '@/features/today/hooks/useToday';
import { applyChanges } from '@/features/routine/slice';
import { useAppDispatch } from '@/store';
import { useSnackbar } from '@/ui';

import { durationText, nightTimes, planNight, planWakeTick } from '../lib/sleep';
import type { useSleep } from './useSleep';

/** Event-time clock (kept out of render for the React Compiler). */
const clock = () => Date.now();

/** Save last night (morning check or sheet) and tick Wake when on time (AC2). */
export function useLogNight(t: ReturnType<typeof useToday>, sleep: ReturnType<typeof useSleep>) {
  const dispatch = useAppDispatch();
  const showSnackbar = useSnackbar();
  return (bed: string, wake: string) => {
    const wakeBlock = t.plan.blocks.find((b) => b.kind === 'wake' && !b.deleted_at);
    const log = wakeBlock
      ? (t.blockLogs.find((l) => l.block_id === wakeBlock.id && !l.deleted_at) ??
        t.blockLogs.find((l) => l.block_id === wakeBlock.id) ??
        null)
      : null;
    const tick = planWakeTick(sleep.today, wakeBlock, log, wake, clock());
    void dispatch(applyChanges([...planNight(sleep.today, sleep.lastNight, bed, wake), ...tick]));
    const { bedAt, wakeAt } = nightTimes(sleep.today, bed, wake);
    showSnackbar({
      message: `Sleep logged · ${durationText(bedAt, wakeAt)}${tick.length ? ` · Wake ticked` : ''}`,
    });
  };
}
