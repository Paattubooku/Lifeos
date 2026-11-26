import { Redirect } from 'expo-router';

import { KeyboardTestScreen } from '@/features/dev/KeyboardTestScreen';

/** Development builds only (Expo Go / npm start). */
export default function KeyboardTestRoute() {
  if (!__DEV__) return <Redirect href="/" />;
  return <KeyboardTestScreen />;
}
