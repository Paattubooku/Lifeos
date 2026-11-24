import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

/** Apple Health connection on this phone (F21). */
export type HealthLink = 'off' | 'connected' | 'denied';

export const stepsSlice = createSlice({
  name: 'steps',
  initialState: { health: 'off' as HealthLink, lastReadAt: null as number | null },
  reducers: {
    healthLinked(state, { payload }: PayloadAction<HealthLink>) {
      state.health = payload;
    },
    healthRead(state, { payload }: PayloadAction<number>) {
      state.lastReadAt = payload;
    },
  },
});

export const { healthLinked, healthRead } = stepsSlice.actions;
