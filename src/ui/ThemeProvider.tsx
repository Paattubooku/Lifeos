import { createContext, type ReactNode, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';

import {
  buildTheme,
  DEFAULT_PREFERENCE,
  resolveScheme,
  type Scheme,
  type Theme,
  type ThemePreference,
} from './theme';

const ThemeContext = createContext<Theme>(buildTheme(resolveScheme(DEFAULT_PREFERENCE, null)));

type Props = {
  /** System / Light / Dark (PRD §7.2). Default Dark. */
  preference?: ThemePreference;
  children: ReactNode;
};

export function ThemeProvider({ preference = DEFAULT_PREFERENCE, children }: Props) {
  const system = useColorScheme();
  const systemScheme: Scheme | null = system === 'light' || system === 'dark' ? system : null;
  const scheme = resolveScheme(preference, systemScheme);
  const theme = useMemo(() => buildTheme(scheme), [scheme]);
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
