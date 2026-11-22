import { type ReactNode } from 'react';
import { type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';

import { PressableScale } from './PressableScale';
import { Text } from './Text';
import { useTheme } from './ThemeProvider';
import { cardShadow, radius, space } from './theme';

type Base = {
  /** Small uppercase line above the title, e.g. "NEXT · 5:30 AM". */
  kicker?: string;
  title?: string;
  children?: ReactNode;
  padding?: number;
  gap?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

type Static = Base & { onPress?: undefined; accessibilityLabel?: string };
type Touchable = Base & { onPress: () => void; accessibilityLabel: string };

export type CardProps = Static | Touchable;

/** Raised plane, radius 16, 1 px hairline, ambient shadow. */
export function Card(props: CardProps) {
  const { colors, scheme } = useTheme();
  const { kicker, title, children, padding = space.lg, gap = space.md, style, testID } = props;

  const cardStyle = [
    styles.card,
    { backgroundColor: colors.raised, borderColor: colors.hairline, padding, gap },
    cardShadow(scheme),
    style,
  ];

  const content = (
    <>
      {kicker ? (
        <Text variant="kicker" tone="secondary">
          {kicker}
        </Text>
      ) : null}
      {title ? (
        <Text variant="heading" accessibilityRole="header">
          {title}
        </Text>
      ) : null}
      {children}
    </>
  );

  if (props.onPress) {
    return (
      <PressableScale
        testID={testID}
        onPress={props.onPress}
        accessibilityLabel={props.accessibilityLabel}
        style={cardStyle}
      >
        {content}
      </PressableScale>
    );
  }
  return (
    <View testID={testID} accessibilityLabel={props.accessibilityLabel} style={cardStyle}>
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.card, borderWidth: 1 },
});
