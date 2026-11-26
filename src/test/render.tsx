import { render } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { ThemeProvider } from '@/ui/ThemeProvider';
import type { ThemePreference } from '@/ui/theme';

/** Render inside the Life theme (dark by default, like the app) and a gesture root. */
export function renderWithTheme(ui: ReactElement, preference: ThemePreference = 'dark') {
  return render(
    <GestureHandlerRootView>
      <ThemeProvider preference={preference}>{ui}</ThemeProvider>
    </GestureHandlerRootView>,
  );
}
