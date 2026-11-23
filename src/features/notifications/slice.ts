import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import { REMINDER_TYPES, type ReminderType } from './schedule';

/** Reminder settings live on this phone (notifications are local to it). */
export type NotificationsState = {
  enabled: Record<ReminderType, boolean>;
  /** Logical day muted with "Quiet today". */
  quietDate: string | null;
};

export const initialNotificationsState: NotificationsState = {
  enabled: Object.fromEntries(REMINDER_TYPES.map((t) => [t, true])) as Record<
    ReminderType,
    boolean
  >,
  quietDate: null,
};

export const notificationsSlice = createSlice({
  name: 'notifications',
  initialState: initialNotificationsState,
  reducers: {
    reminderToggled(state, { payload }: PayloadAction<{ type: ReminderType; on: boolean }>) {
      state.enabled[payload.type] = payload.on;
    },
    quietToday(state, { payload }: PayloadAction<string | null>) {
      state.quietDate = payload;
    },
  },
});

export const { reminderToggled, quietToday } = notificationsSlice.actions;
