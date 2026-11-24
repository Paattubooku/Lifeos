import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

/** Apple Health connection on this phone (F21). */
export type HealthLink = 'off' | 'connected' | 'denied';
/** iPhone motion-chip counting (free, Expo Go). */
export type MotionLink = 'off' | 'on' | 'denied';

export const stepsSlice = createSlice({
  name: 'steps',
  initialState: {
    health: 'off' as HealthLink,
    motion: 'off' as MotionLink,
    lastReadAt: null as number | null,
  },
  reducers: {
    healthLinked(state, { payload }: PayloadAction<HealthLink>) {
      state.health = payload;
    },
    motionLinked(state, { payload }: PayloadAction<MotionLink>) {
      state.motion = payload;
    },
    healthRead(state, { payload }: PayloadAction<number>) {
      state.lastReadAt = payload;
    },
  },
});

export const { healthLinked, motionLinked, healthRead } = stepsSlice.actions;
