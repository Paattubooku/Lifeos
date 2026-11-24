import { createAction, createSlice, type PayloadAction } from '@reduxjs/toolkit';

import { DEFAULT_PREFERENCE, type ThemePreference } from '@/ui/theme';

/** App-wide, device-local preferences. Profile data (synced) arrives in F03. */
export type AppState = {
  themePreference: ThemePreference;
  /** Logical day the water goal toast + haptic last fired (once a day, F07 AC4). */
  waterGoalCelebrated?: string | null;
  /** F25: the account whose data is cached on this phone (null = none yet). */
  account?: string | null;
};

/**
 * F25: forget everything cached for the previous account (API cache, drafts,
 * per-feature state). The sync queue stays: every write carries its owner and
 * is only pushed or shown for that account.
 */
export const accountCleared = createAction('app/accountCleared');

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
    accountSet(state, action: PayloadAction<string | null>) {
      state.account = action.payload;
    },
  },
  extraReducers: (b) => {
    b.addCase(accountCleared, (state) => {
      state.waterGoalCelebrated = null;
    });
  },
});

export const { setThemePreference, waterGoalCelebrated, accountSet } = appSlice.actions;
