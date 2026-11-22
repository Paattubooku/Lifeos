import { Text as RNText, type TextProps, type TextStyle } from 'react-native';

import { type Accent, type TypeVariant, fonts } from './theme';
import { useTheme } from './ThemeProvider';

export type TextTone = 'default' | 'secondary' | 'onButton' | 'onInverse' | Accent;

export type Props = TextProps & {
  variant?: TypeVariant;
  tone?: TextTone;
  /** Override weight within the variant's family. */
  weight?: 400 | 500 | 600 | 700 | 800;
  /** Tabular figures for numbers. */
  num?: boolean;
  align?: TextStyle['textAlign'];
  strike?: boolean;
};

function familyFor(family: 'display' | 'body', weight: number): string {
  if (family === 'display') {
    if (weight >= 800) return fonts.display[800];
    if (weight >= 700) return fonts.display[700];
    if (weight >= 600) return fonts.display[600];
    return fonts.display[500];
  }
  if (weight >= 700) return fonts.body[700];
  if (weight >= 600) return fonts.body[600];
  if (weight >= 500) return fonts.body[500];
  return fonts.body[400];
}

export function Text({
  variant = 'body',
  tone = 'default',
  weight,
  num,
  align,
  strike,
  style,
  ...rest
}: Props) {
  const { colors, type } = useTheme();
  const t = type[variant];
  const color =
    tone === 'default'
      ? colors.text
      : tone === 'secondary'
        ? colors.textSecondary
        : tone === 'onButton'
          ? colors.onButton
          : tone === 'onInverse'
            ? colors.onInverse
            : colors.accents[tone].text;

  return (
    <RNText
      style={[
        {
          fontFamily: familyFor(t.family, weight ?? t.weight),
          fontSize: t.fontSize,
          lineHeight: t.lineHeight,
          letterSpacing: t.letterSpacing,
          color,
          textAlign: align,
        },
        variant === 'kicker' && { textTransform: 'uppercase' },
        num && { fontVariant: ['tabular-nums'] },
        strike && { textDecorationLine: 'line-through' },
        style,
      ]}
      {...rest}
    />
  );
}
