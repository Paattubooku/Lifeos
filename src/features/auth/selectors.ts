import type { RootState } from '@/store';

export const selectAuth = (s: RootState) => s.auth;
export const selectAuthStatus = (s: RootState) => s.auth.status;
export const selectIsSignedIn = (s: RootState) => s.auth.status === 'signedIn';
export const selectUser = (s: RootState) => s.auth.user;
