import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import { DEFAULT_PREFERENCE, type ThemePreference } from '@/ui/theme';

/** App-wide, device-local preferences. Profile data (synced) arrives in F03. */
export type AppState = {
  themePreference: ThemePreference;
  /** Logical day the water goal toast + haptic last fired (once a day, F07 AC4). */
  waterGoalCelebrated?: string | null;
};

const initialState: AppState = {
  themePreference: DEFAULT_PREFERENCE,
};

export const appSlice = createSlice({
  name: 'app',
  initialState,
  reducers: {
    setThemePreference(state, action: PayloadAction<ThemePreference>) {
      state.themePreference = action.payload;
    },
    waterGoalCelebrated(state, action: PayloadAction<string>) {
      state.waterGoalCelebrated = action.payload;
    },
  },
});

export const { setThemePreference, waterGoalCelebrated } = appSlice.actions;
