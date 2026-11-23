import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

/**
 * The running session's clocks, persisted so an app kill resumes with the
 * right time (timestamps, not counters — PRD F11 edge case).
 */
export type TrainState = {
  rest: { date: string; endsAt: number; totalSec: number } | null;
  hold: { date: string; exerciseId: string; setNo: number; startedAt: number } | null;
  /** Exercise the logger shows (null = the first with sets left). */
  focus: { date: string; exerciseId: string } | null;
};

export const initialTrainState: TrainState = { rest: null, hold: null, focus: null };

export const trainSlice = createSlice({
  name: 'train',
  initialState: initialTrainState,
  reducers: {
    restStarted(
      state,
      { payload }: PayloadAction<{ date: string; endsAt: number; totalSec: number }>,
    ) {
      state.rest = payload;
    },
    restEnded(state) {
      state.rest = null;
    },
    holdStarted(state, { payload }: PayloadAction<NonNullable<TrainState['hold']>>) {
      state.hold = payload;
    },
    holdEnded(state) {
      state.hold = null;
    },
    focused(state, { payload }: PayloadAction<TrainState['focus']>) {
      state.focus = payload;
    },
  },
});

export const { restStarted, restEnded, holdStarted, holdEnded, focused } = trainSlice.actions;
