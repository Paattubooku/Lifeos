import { type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';

import { Text } from './Text';
import { useTheme } from './ThemeProvider';
import { type Accent, cardShadow, radius } from './theme';

export type StatTileProps = {
  /** e.g. "Protein" — shown uppercase. */
  label: string;
  value: string;
  sub?: string;
  /** Dot colour; omit for the neutral dot. */
  accent?: Accent;
  style?: StyleProp<ViewStyle>;
};

/** Small card: dot + kicker, metric value, sub-line ("32 g · of 150 g"). */
export function StatTile({ label, value, sub, accent, style }: StatTileProps) {
  const { colors, scheme } = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={[label, value, sub].filter(Boolean).join(', ')}
      style={[
        styles.tile,
        { backgroundColor: colors.raised, borderColor: colors.hairline },
        cardShadow(scheme),
        style,
      ]}
    >
      <View style={styles.kicker}>
        <View
          style={[
            styles.dot,
            { backgroundColor: accent ? colors.accents[accent].base : colors.border },
          ]}
        />
        <Text variant="kicker" tone="secondary" numberOfLines={1}>
          {label}
        </Text>
      </View>
      <Text variant="stat" num numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      {sub ? (
        <Text variant="caption" tone="secondary" numberOfLines={1}>
          {sub}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { flex: 1, minWidth: 0, borderRadius: radius.card, borderWidth: 1, padding: 12, gap: 4 },
  kicker: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3 },
});
