import { cancelRestEnd, scheduleRestEnd } from '@/features/notifications/os';
import type { Change } from '@/features/routine/lib/changes';
import { applyChanges } from '@/features/routine/slice';
import type { DateString } from '@/lib/dates';
import { newClientId } from '@/lib/ids';
import { useAppDispatch, useAppSelector } from '@/store';
import { haptics, useSnackbar } from '@/ui';

import { type WorkoutItem } from '../lib/program';
import {
  planFinish,
  planLogSet,
  planStartSession,
  planWalkDone,
  type SessionRow,
  type SetLogRow,
} from '../lib/session';
import { holdEnded, holdStarted, restEnded, restStarted } from '../slice';

/** Event-time clock (kept out of render for the React Compiler). */
const clock = () => Date.now();

export function useTrainActions() {
  const dispatch = useAppDispatch();
  const showSnackbar = useSnackbar();
  const rest = useAppSelector((s) => s.train.rest);
  const apply = (changes: Change[]) => dispatch(applyChanges(changes));

  const startRest = (date: DateString, seconds: number, nextLabel: string) => {
    if (seconds <= 0) return;
    const endsAt = clock() + seconds * 1000;
    dispatch(restStarted({ date, endsAt, totalSec: seconds }));
    void scheduleRestEnd(endsAt, nextLabel);
  };

  return {
    /** Start (or resume) the date's session; returns its id. */
    start: async (date: DateString, dayId: string, existing: SessionRow | null) => {
      const { sessionId, changes } = planStartSession(
        date,
        dayId,
        existing,
        { sessionId: newClientId() },
        clock(),
      );
      if (changes.length) await apply(changes);
      return sessionId;
    },

    /** Log a set, then rest (F11: the rest timer works in the background via a notification). */
    logSet: async (
      ctx: {
        session: SessionRow;
        items: readonly WorkoutItem[];
        logs: readonly SetLogRow[];
        date: DateString;
      },
      set: {
        exerciseId: string;
        setNo: number;
        weight: number | null;
        reps: number | null;
        duration: number | null;
      },
      restSec: number,
      nextLabel: string,
    ) => {
      haptics.success();
      await apply(planLogSet(ctx, set));
      startRest(ctx.date, restSec, nextLabel);
    },

    addRest: (seconds: number, nextLabel: string) => {
      if (!rest) return;
      const endsAt = rest.endsAt + seconds * 1000;
      dispatch(restStarted({ ...rest, endsAt, totalSec: rest.totalSec + seconds }));
      void scheduleRestEnd(endsAt, nextLabel);
    },

    skipRest: () => {
      dispatch(restEnded());
      void cancelRestEnd();
    },

    startHold: (date: DateString, exerciseId: string, setNo: number) =>
      dispatch(holdStarted({ date, exerciseId, setNo, startedAt: clock() })),
    endHold: () => dispatch(holdEnded()),

    finish: async (
      session: SessionRow,
      items: readonly WorkoutItem[],
      logs: readonly SetLogRow[],
    ) => {
      dispatch(restEnded());
      void cancelRestEnd();
      await apply(planFinish(session, items, logs, clock()));
    },

    walkDone: async (date: DateString, dayId: string, existing: SessionRow | null) => {
      haptics.success();
      await apply(planWalkDone(date, dayId, existing, newClientId(), clock()));
      showSnackbar({ message: 'Walk logged · 30 min' });
    },
  };
}
