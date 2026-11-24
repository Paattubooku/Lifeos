import { useState } from 'react';

import type { TaskDbRow } from '../api';
import { SwapTop3Sheet, TaskOptionsSheet } from '../components/TaskSheets';
import { isTop3Today, type TaskRow } from '../lib/tasks';
import { type NewTask, useTaskActions } from './useTaskActions';

type Swap = { title: string; full: TaskRow[]; swap: (id: string) => void; keep: () => void };

/** Actions plus the swap and options sheets, shared by the Tasks screen and Today's card. */
export function useTop3Flow(all: readonly TaskDbRow[], today: string) {
  const actions = useTaskActions(all, today);
  const [swap, setSwap] = useState<Swap | null>(null);
  const [options, setOptions] = useState<TaskRow | null>(null);

  const addToTop3 = (t: TaskRow) => {
    const full = actions.addToTop3(t);
    if (full)
      setSwap({
        title: t.title,
        full,
        swap: (id) => void actions.addToTop3(t, id),
        keep: () => undefined,
      });
  };

  const create = (input: NewTask) => {
    const full = actions.create(input);
    if (full)
      setSwap({
        title: input.title.trim(),
        full,
        swap: (id) => void actions.create(input, id),
        keep: () => void actions.create({ ...input, top3: false }),
      });
  };

  const sheets = (
    <>
      {swap ? (
        <SwapTop3Sheet
          title={swap.title}
          full={swap.full}
          today={today}
          onClose={() => setSwap(null)}
          onSwap={(id) => {
            setSwap(null);
            swap.swap(id);
          }}
          onKeep={() => {
            setSwap(null);
            swap.keep();
          }}
        />
      ) : null}
      {options ? (
        <TaskOptionsSheet
          task={options}
          inTop3={isTop3Today(options, today)}
          onClose={() => setOptions(null)}
          onTop3={() => {
            const t = options;
            setOptions(null);
            if (isTop3Today(t, today)) actions.removeFromTop3(t);
            else addToTop3(t);
          }}
          onDelete={() => {
            const t = options;
            setOptions(null);
            actions.remove(t);
          }}
        />
      ) : null}
    </>
  );

  return { ...actions, addToTop3, create, openOptions: setOptions, sheets };
}
