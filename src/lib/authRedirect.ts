import * as Linking from 'expo-linking';

import { AUTH_CALLBACK_PATH } from '@/features/auth/lib/authLink';

/**
 * Where email links send people back to: `lifeos://auth-callback` in an
 * installed build, `exp://…/--/auth-callback` in Expo Go. Must match a Supabase
 * Redirect URL (`lifeos://**`, `exp://**`).
 */
export const authRedirectUrl = () => Linking.createURL(AUTH_CALLBACK_PATH);
