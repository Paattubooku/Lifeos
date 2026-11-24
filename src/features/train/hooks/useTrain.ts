import { useMemo } from 'react';

import { useLocalWrites } from '@/features/profile/hooks/useProfileData';
import type { useToday } from '@/features/today/hooks/useToday';
import { live, mergeKeepingDeleted } from '@/features/today/lib/merge';
import { sessionFor } from '@/features/today/lib/program';
import { addDays, type DateString } from '@/lib/dates';

import {
  type ProgramFull,
  useGetProgramQuery,
  useGetSessionsSinceQuery,
  useGetSetLogsSinceQuery,
} from '../api';
import { type ExerciseRow, itemsOf, type WorkoutItem } from '../lib/program';
import type { SessionRow, SetLogRow } from '../lib/session';

const EMPTY: ProgramFull = { days: [], items: [], exercises: [] };

/** Program, sessions and sets (60 days) with this phone's unsynced writes applied. */
export function useTrain(t: ReturnType<typeof useToday>) {
  const programId =
    t.programCtx.program && 'id' in t.programCtx.program
      ? String((t.programCtx.program as { id: string }).id)
      : '';
  const progQ = useGetProgramQuery(programId, { skip: !programId });
  const setsQ = useGetSetLogsSinceQuery(addDays(t.today, -60));
  const sessQ = useGetSessionsSinceQuery(addDays(t.today, -13));
  const setWrites = useLocalWrites('set_log');
  const sessionWrites = useLocalWrites('session_log');

  // F23: the program editor's unsynced edits (workout_exercise rows) apply at once.
  const itemWrites = useLocalWrites('workout_exercise');
  const program = useMemo(() => {
    const base = progQ.data ?? EMPTY;
    if (itemWrites.length === 0) return base;
    const items = mergeKeepingDeleted<WorkoutItem & { client_id: string }>(
      base.items.filter((i): i is WorkoutItem & { client_id: string } => Boolean(i.client_id)),
      itemWrites,
    );
    return { ...base, items: [...base.items.filter((i) => !i.client_id), ...items] };
  }, [progQ.data, itemWrites]);
  const logs = useMemo(
    () => live(mergeKeepingDeleted<SetLogRow>(setsQ.data ?? [], setWrites)),
    [setsQ.data, setWrites],
  );
  const sessions = useMemo(
    () => mergeKeepingDeleted<SessionRow>(sessQ.data ?? [], sessionWrites),
    [sessQ.data, sessionWrites],
  );
  const exercises = useMemo(
    () => new Map<string, ExerciseRow>(program.exercises.map((e) => [e.id, e])),
    [program.exercises],
  );

  /** A date's workout day and its exercises (moved sessions included). */
  const dayOf = (date: DateString) => {
    const day = sessionFor(date, t.programCtx);
    const full = day
      ? (program.days.find((d) => d.id === day.id) ?? { ...day, rounds: null })
      : null;
    return { day: full, items: full ? itemsOf(program.items, full.id) : [] };
  };
  const sessionOn = (date: DateString) => sessions.find((s) => s.date === date) ?? null;

  return {
    program,
    programId,
    logs,
    sessions,
    exercises,
    dayOf,
    sessionOn,
    isLoading: progQ.isLoading,
  };
}
