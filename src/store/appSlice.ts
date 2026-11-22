import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import { DEFAULT_PREFERENCE, type ThemePreference } from '@/ui/theme';

/** App-wide, device-local preferences. Profile data (synced) arrives in F03. */
export type AppState = {
  themePreference: ThemePreference;
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
  },
});

export const { setThemePreference } = appSlice.actions;
