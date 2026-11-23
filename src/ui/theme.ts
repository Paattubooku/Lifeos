/**
 * LifeOS design tokens — the only file allowed to contain colour literals
 * (enforced by eslint.config.js).
 *
 * Source: PRD §7.2 and design/source/{Main,Components-1,Components-2}(-Dark).dc.html.
 * Each accent has a solid `base` (fills, icons), a `text` step that passes AA
 * on the theme's surfaces, a 12% `tint` for chips/icon tiles, and a two-stop
 * `gradient` used by rings and bars.
 */
import type { TextStyle } from 'react-native';

export type Scheme = 'light' | 'dark';
export type ThemePreference = 'system' | 'light' | 'dark';
export type Accent = 'primary' | 'water' | 'protein' | 'calories' | 'success' | 'danger';

export type AccentTokens = {
  /** Solid colour for fills, dots, icons. */
  base: string;
  /** Lighter step ("→" in PRD §7.2). */
  light: string;
  /** Colour to use when the accent is text on canvas/raised. */
  text: string;
  /** 12% tint background (status chips, icon tiles, tab pill). */
  tint: string;
  /** Two-stop gradient for rings and progress fills. */
  gradient: readonly [string, string];
};

export type Palette = {
  canvas: string;
  raised: string;
  recessed: string;
  text: string;
  textSecondary: string;
  /** 1 px card / row hairline. */
  hairline: string;
  /** Stronger outline: inputs, checkboxes, outline buttons, sheet handle. */
  border: string;
  ringTrack: string;
  tabBar: string;
  /** "Act now" button fill (same in both themes). */
  buttonPrimary: string;
  buttonWater: string;
  buttonDestructive: string;
  onButton: string;
  /** Metric-ghost button background (10% primary). */
  ghost: string;
  scrim: string;
  /** Snackbar: inverted surface. */
  inverseSurface: string;
  onInverse: string;
  inverseAction: string;
  shadow: string;
  accents: Record<Accent, AccentTokens>;
};

const dark: Palette = {
  canvas: '#0A0F1C',
  raised: '#131B2E',
  recessed: '#1A2338',
  text: '#F1F5F9',
  textSecondary: '#94A3B8',
  hairline: '#1F2A40',
  border: '#334155',
  ringTrack: '#1E293B',
  tabBar: '#0F1626',
  buttonPrimary: '#2563EB',
  buttonWater: '#0369A1',
  buttonDestructive: '#E11D48',
  onButton: '#FFFFFF',
  ghost: 'rgba(96,165,250,0.10)',
  scrim: 'rgba(5,8,16,0.62)',
  inverseSurface: '#F1F5F9',
  onInverse: '#0A0F1C',
  inverseAction: '#2563EB',
  shadow: '#000000',
  accents: {
    primary: {
      base: '#60A5FA',
      light: '#3B82F6',
      text: '#60A5FA',
      tint: 'rgba(96,165,250,0.12)',
      gradient: ['#60A5FA', '#3B82F6'],
    },
    water: {
      base: '#38BDF8',
      light: '#7DD3FC',
      text: '#38BDF8',
      tint: 'rgba(56,189,248,0.12)',
      gradient: ['#0EA5E9', '#7DD3FC'],
    },
    protein: {
      base: '#A78BFA',
      light: '#C4B5FD',
      text: '#A78BFA',
      tint: 'rgba(167,139,250,0.12)',
      gradient: ['#A78BFA', '#C4B5FD'],
    },
    calories: {
      base: '#FB923C',
      light: '#FDBA74',
      text: '#FB923C',
      tint: 'rgba(251,146,60,0.12)',
      gradient: ['#F97316', '#FDBA74'],
    },
    success: {
      base: '#34D399',
      light: '#6EE7B7',
      text: '#34D399',
      tint: 'rgba(52,211,153,0.12)',
      gradient: ['#059669', '#34D399'],
    },
    danger: {
      base: '#FB7185',
      light: '#FDA4AF',
      text: '#FB7185',
      tint: 'rgba(251,113,133,0.12)',
      gradient: ['#E11D48', '#FB7185'],
    },
  },
};

const light: Palette = {
  canvas: '#F8FAFC',
  raised: '#FFFFFF',
  recessed: '#F1F5F9',
  text: '#0F172A',
  textSecondary: '#64748B',
  hairline: '#E2E8F0',
  border: '#CBD5E1',
  ringTrack: '#F1F5F9',
  tabBar: '#FFFFFF',
  buttonPrimary: '#2563EB',
  buttonWater: '#0369A1',
  buttonDestructive: '#E11D48',
  onButton: '#FFFFFF',
  ghost: 'rgba(37,99,235,0.10)',
  scrim: 'rgba(248,250,252,0.75)',
  inverseSurface: '#0F172A',
  onInverse: '#F8FAFC',
  inverseAction: '#60A5FA',
  shadow: '#0F172A',
  accents: {
    primary: {
      base: '#2563EB',
      light: '#1D4ED8',
      text: '#2563EB',
      tint: 'rgba(37,99,235,0.12)',
      gradient: ['#2563EB', '#1D4ED8'],
    },
    water: {
      base: '#0369A1',
      light: '#38BDF8',
      text: '#0369A1',
      tint: 'rgba(3,105,161,0.12)',
      gradient: ['#0284C7', '#38BDF8'],
    },
    protein: {
      base: '#7C3AED',
      light: '#8B5CF6',
      text: '#7C3AED',
      tint: 'rgba(124,58,237,0.12)',
      gradient: ['#7C3AED', '#8B5CF6'],
    },
    calories: {
      base: '#C2410C',
      light: '#FB923C',
      text: '#C2410C',
      tint: 'rgba(194,65,12,0.12)',
      gradient: ['#F97316', '#FB923C'],
    },
    success: {
      base: '#047857',
      light: '#059669',
      text: '#047857',
      tint: 'rgba(4,120,87,0.12)',
      gradient: ['#047857', '#059669'],
    },
    danger: {
      base: '#E11D48',
      light: '#FB7185',
      text: '#E11D48',
      tint: 'rgba(225,29,72,0.12)',
      gradient: ['#E11D48', '#FB7185'],
    },
  },
};

export const palettes: Record<Scheme, Palette> = { dark, light };

export const DEFAULT_PREFERENCE: ThemePreference = 'dark';

export function resolveScheme(pref: ThemePreference, system: Scheme | null | undefined): Scheme {
  if (pref === 'system') return system === 'light' ? 'light' : 'dark';
  return pref;
}

/** 4 / 8 / 12 / 16 / 24 / 32 */
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const radius = {
  button: 12,
  card: 16,
  sheet: 24,
  pill: 999,
  checkbox: 6,
  tile: 10,
} as const;

/** Minimum touch target (PRD §4.5). */
export const TOUCH_MIN = 44;

/** Bundled via @expo-google-fonts — each weight is its own family in React Native. */
export const fonts = {
  display: {
    500: 'PlusJakartaSans_500Medium',
    600: 'PlusJakartaSans_600SemiBold',
    700: 'PlusJakartaSans_700Bold',
    800: 'PlusJakartaSans_800ExtraBold',
  },
  body: {
    400: 'Inter_400Regular',
    500: 'Inter_500Medium',
    600: 'Inter_600SemiBold',
    700: 'Inter_700Bold',
  },
} as const;

export type DisplayWeight = keyof typeof fonts.display;
export type BodyWeight = keyof typeof fonts.body;

type TypeStyle = Required<Pick<TextStyle, 'fontSize' | 'lineHeight' | 'letterSpacing'>> & {
  family: 'display' | 'body';
  weight: DisplayWeight | BodyWeight;
};

/** letter-spacing in the designs is em; React Native needs px. */
const em = (size: number, value: number) => Math.round(size * value * 100) / 100;

/** Type scale 48 / 36 / 28 / 20 / 16 / 14 / 12 (+ 11 uppercase kicker, 15 button). */
export const type = {
  hero: {
    family: 'display',
    weight: 700,
    fontSize: 48,
    lineHeight: 56,
    letterSpacing: em(48, -0.03),
  },
  title: {
    family: 'display',
    weight: 700,
    fontSize: 36,
    lineHeight: 44,
    letterSpacing: em(36, -0.03),
  },
  metric: {
    family: 'display',
    weight: 700,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: em(28, -0.02),
  },
  stat: {
    family: 'display',
    weight: 700,
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: em(24, -0.02),
  },
  heading: {
    family: 'display',
    weight: 700,
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: em(20, -0.02),
  },
  body: { family: 'body', weight: 400, fontSize: 16, lineHeight: 22, letterSpacing: 0 },
  button: {
    family: 'body',
    weight: 600,
    fontSize: 15,
    lineHeight: 20,
    letterSpacing: em(15, -0.01),
  },
  sub: { family: 'body', weight: 400, fontSize: 14, lineHeight: 20, letterSpacing: 0 },
  caption: { family: 'body', weight: 400, fontSize: 12, lineHeight: 16, letterSpacing: 0 },
  kicker: {
    family: 'body',
    weight: 600,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: em(11, 0.04),
  },
} as const satisfies Record<string, TypeStyle>;

export type TypeVariant = keyof typeof type;

/** Motion tokens (Components-2 "Motion" table). All animations are skipped under Reduce Motion. */
export const motion = {
  ring: 1400,
  countUp: 1400,
  bar: 1100,
  barDelay: 300,
  pace: 2000,
  sheet: 600,
  scrim: 350,
  snackbar: 5000,
  press: 0.98,
  done: 500,
  fabRipple: 2800,
  beacon: 1600,
  stagger: 60,
  /** cubic-bezier(.4,0,.2,1) */
  ease: [0.4, 0, 0.2, 1] as const,
  /** cubic-bezier(.34,1.3,.64,1) — gentle overshoot */
  spring: [0.34, 1.3, 0.64, 1] as const,
} as const;

/** Card elevation: approximates the design's dual ambient shadow (iOS) / elevation (Android). */
export function cardShadow(scheme: Scheme) {
  return {
    shadowColor: palettes[scheme].shadow,
    shadowOpacity: scheme === 'dark' ? 0.35 : 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  } as const;
}

export type Theme = {
  scheme: Scheme;
  colors: Palette;
  space: typeof space;
  radius: typeof radius;
  type: typeof type;
  fonts: typeof fonts;
  motion: typeof motion;
};

export function buildTheme(scheme: Scheme): Theme {
  return { scheme, colors: palettes[scheme], space, radius, type, fonts, motion };
}

/** '#34D399' + 0.3 → 'rgba(52,211,153,0.3)'. For tints of theme tokens only. */
export function withAlpha(hex: string, alpha: number): string {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return hex;
  const [r, g, b] = [m[1], m[2], m[3]].map((h) => parseInt(h as string, 16));
  return `rgba(${r},${g},${b},${alpha})`;
}
