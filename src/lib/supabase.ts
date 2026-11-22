import 'react-native-url-polyfill/auto';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { AppState, Platform } from 'react-native';

import type { Database } from '@/types/supabase';

import { supabaseConfig } from './config';
import { createChunkedSecureStorage } from './secureStorage';

export type LifeosClient = SupabaseClient<Database>;

/** Key under which the session lives in SecureStore (chunked). */
export const AUTH_STORAGE_KEY = 'lifeos-auth';

export class SupabaseNotConfiguredError extends Error {
  constructor() {
    super(
      'Supabase is not configured. Copy .env.example to .env and fill in the URL and anon key.',
    );
    this.name = 'SupabaseNotConfiguredError';
  }
}

/** Session storage: SecureStore on device; the browser's default on web (dev checks only). */
export const authStorage =
  Platform.OS === 'web' ? undefined : createChunkedSecureStorage(SecureStore);

let client: LifeosClient | null = null;

/** The app's single Supabase client (anon key only — never the service-role key). */
export function getSupabase(): LifeosClient {
  if (!supabaseConfig) throw new SupabaseNotConfiguredError();
  if (!client) {
    client = createClient<Database>(supabaseConfig.url, supabaseConfig.anonKey, {
      auth: {
        storage: authStorage,
        storageKey: AUTH_STORAGE_KEY,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    });
    // Refresh tokens only while the app is in the foreground (Supabase RN guidance).
    AppState.addEventListener('change', (state) => {
      if (state === 'active') client?.auth.startAutoRefresh();
      else client?.auth.stopAutoRefresh();
    });
  }
  return client;
}

export const isSupabaseConfigured = supabaseConfig !== null;
