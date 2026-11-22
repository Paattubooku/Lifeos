import { renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import * as RN from 'react-native';

import { ThemeProvider, useTheme } from '../ThemeProvider';
import { buildTheme, palettes, radius, resolveScheme, space, type } from '../theme';

describe('theme tokens (PRD §7.2)', () => {
  it('matches the PRD dark/light surface and text tokens', () => {
    expect(palettes.dark).toMatchObject({
      canvas: '#0A0F1C',
      raised: '#131B2E',
      recessed: '#1A2338',
      text: '#F1F5F9',
      textSecondary: '#94A3B8',
    });
    expect(palettes.light).toMatchObject({
      canvas: '#F8FAFC',
      raised: '#FFFFFF',
      recessed: '#F1F5F9',
      text: '#0F172A',
      textSecondary: '#64748B',
    });
  });

  it('matches the PRD accent pairs', () => {
    const pair = (s: 'dark' | 'light', a: keyof typeof palettes.dark.accents) => [
      palettes[s].accents[a].base,
      palettes[s].accents[a].light,
    ];
    expect(pair('dark', 'primary')).toEqual(['#60A5FA', '#3B82F6']);
    expect(pair('dark', 'water')).toEqual(['#38BDF8', '#7DD3FC']);
    expect(pair('dark', 'protein')).toEqual(['#A78BFA', '#C4B5FD']);
    expect(pair('dark', 'calories')).toEqual(['#FB923C', '#FDBA74']);
    expect(palettes.dark.accents.success.base).toBe('#34D399');
    expect(palettes.dark.accents.danger.base).toBe('#FB7185');
    expect(pair('light', 'primary')).toEqual(['#2563EB', '#1D4ED8']);
    expect(pair('light', 'water')).toEqual(['#0369A1', '#38BDF8']);
    expect(pair('light', 'protein')).toEqual(['#7C3AED', '#8B5CF6']);
    expect(pair('light', 'calories')).toEqual(['#C2410C', '#FB923C']);
    expect(palettes.light.accents.success.base).toBe('#047857');
    expect(palettes.light.accents.danger.base).toBe('#E11D48');
  });

  it('keeps cobalt buttons with white text in both themes', () => {
    for (const s of ['dark', 'light'] as const) {
      expect(palettes[s].buttonPrimary).toBe('#2563EB');
      expect(palettes[s].onButton).toBe('#FFFFFF');
    }
  });

  it('defines every token in both themes', () => {
    expect(Object.keys(palettes.light).sort()).toEqual(Object.keys(palettes.dark).sort());
    for (const s of ['dark', 'light'] as const) {
      for (const accent of Object.values(palettes[s].accents)) {
        expect(accent.gradient).toHaveLength(2);
        expect(accent.tint).toMatch(/^rgba\(/);
      }
    }
  });

  it('uses the design scales', () => {
    expect(Object.values(space)).toEqual([4, 8, 12, 16, 24, 32]);
    expect(radius).toMatchObject({ button: 12, card: 16, pill: 999 });
    const sizes = new Set<number>(Object.values(type).map((t) => t.fontSize));
    for (const size of [48, 36, 28, 20, 16, 14, 12]) expect(sizes.has(size)).toBe(true);
  });

  it('resolves the theme preference, defaulting to dark', () => {
    expect(resolveScheme('dark', 'light')).toBe('dark');
    expect(resolveScheme('light', 'dark')).toBe('light');
    expect(resolveScheme('system', 'light')).toBe('light');
    expect(resolveScheme('system', 'dark')).toBe('dark');
    expect(resolveScheme('system', null)).toBe('dark');
    expect(buildTheme('light').colors).toBe(palettes.light);
  });
});

describe('ThemeProvider', () => {
  const wrap = (preference: 'system' | 'light' | 'dark') =>
    function Wrapper({ children }: { children: ReactNode }) {
      return <ThemeProvider preference={preference}>{children}</ThemeProvider>;
    };

  it('defaults to dark without a provider', async () => {
    const { result } = await renderHook(() => useTheme());
    expect(result.current.scheme).toBe('dark');
  });

  it('applies an explicit preference', async () => {
    const { result } = await renderHook(() => useTheme(), { wrapper: wrap('light') });
    expect(result.current.colors.canvas).toBe('#F8FAFC');
  });

  it('follows the phone when set to System', async () => {
    const spy = jest.spyOn(RN, 'useColorScheme').mockReturnValue('light');
    const { result } = await renderHook(() => useTheme(), { wrapper: wrap('system') });
    expect(result.current.scheme).toBe('light');
    spy.mockReturnValue('dark');
    const second = await renderHook(() => useTheme(), { wrapper: wrap('system') });
    expect(second.result.current.scheme).toBe('dark');
    spy.mockRestore();
  });
});
