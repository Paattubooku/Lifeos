import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';

import type { AuthDeps } from '@/features/auth/slice';
import { queueUpsert, type SyncRoot } from '@/features/sync/slice';

import type { Write } from './lib/plan';
import type { ProfileFields } from './lib/targets';

export type ProfileState = {
  /** Onboarding answers so far (persisted: survives an app kill mid-onboarding). */
  draft: ProfileFields | null;
};

export const initialProfileState: ProfileState = { draft: null };

/** Queues planned writes in order (each one is optimistic and syncs on its own). */
export const applyWrites = createAsyncThunk<
  number,
  readonly Write[],
  { extra: AuthDeps; state: SyncRoot }
>('profile/applyWrites', async (writes, { dispatch }) => {
  let applied = 0;
  for (const w of writes) {
    const res = await dispatch(queueUpsert({ table: w.table, row: w.row, clientId: w.clientId }));
    if (queueUpsert.fulfilled.match(res)) applied++;
  }
  return applied;
});

export const profileSlice = createSlice({
  name: 'profile',
  initialState: initialProfileState,
  reducers: {
    draftStarted(state, { payload }: PayloadAction<ProfileFields>) {
      if (!state.draft) state.draft = payload;
    },
    draftUpdated(state, { payload }: PayloadAction<Partial<ProfileFields>>) {
      if (state.draft) state.draft = { ...state.draft, ...payload };
    },
    draftCleared(state) {
      state.draft = null;
    },
  },
});

export const { draftStarted, draftUpdated, draftCleared } = profileSlice.actions;
