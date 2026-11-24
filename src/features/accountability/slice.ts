import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

/** Per-phone state of the nudges (F24): the failure-interrupt snooze. */
export const accountabilitySlice = createSlice({
  name: 'accountability',
  initialState: { snoozedUntil: null as number | null },
  reducers: {
    interruptSnoozed(state, { payload }: PayloadAction<number | null>) {
      state.snoozedUntil = payload;
    },
  },
});

export const { interruptSnoozed } = accountabilitySlice.actions;
