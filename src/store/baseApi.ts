import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react';

/**
 * Root RTK Query API. Features add endpoints with `baseApi.injectEndpoints`.
 * The Supabase-backed queries arrive in F01/F02; until then there are no endpoints.
 */
export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: fakeBaseQuery<{ message: string }>(),
  tagTypes: [],
  endpoints: () => ({}),
});
