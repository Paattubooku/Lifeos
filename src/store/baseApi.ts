import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react';
import type { Action } from '@reduxjs/toolkit';
import { REHYDRATE } from 'redux-persist';

export const TAGS = ['Profile', 'Routine', 'DayLog', 'Weight', 'Program'] as const;
export type Tag = (typeof TAGS)[number];

type RehydrateAction = Action<typeof REHYDRATE> & {
  key?: string;
  payload?: Record<string, unknown>;
};

const isRehydrate = (action: Action): action is RehydrateAction => action.type === REHYDRATE;

/**
 * Root RTK Query API. Features add endpoints with `baseApi.injectEndpoints`;
 * each endpoint's queryFn talks to Supabase (see supabaseQuery.ts).
 * The cache is persisted with the root key so reads work offline (PRD §1.3).
 */
export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: fakeBaseQuery<{ message: string }>(),
  tagTypes: TAGS,
  endpoints: () => ({}),
  extractRehydrationInfo(action, { reducerPath }) {
    if (isRehydrate(action) && action.key === 'lifeos-root') {
      return action.payload?.[reducerPath] as never;
    }
    return undefined;
  },
});
