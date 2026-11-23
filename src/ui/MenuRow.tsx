import { ChevronRight, type LucideIcon } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { PressableScale } from './PressableScale';
import { Text } from './Text';
import { useTheme } from './ThemeProvider';
import type { Accent } from './theme';

export type MenuRowProps = {
  icon: LucideIcon;
  accent?: Accent;
  title: string;
  sub?: string;
  onPress: () => void;
  /** Hairline under the row (all but the last in a group). */
  divider?: boolean;
  testID?: string;
};

/** More-Menu row: tinted icon, title + one line, chevron. */
export function MenuRow({
  icon: Icon,
  accent = 'primary',
  title,
  sub,
  onPress,
  divider,
  testID,
}: MenuRowProps) {
  const { colors } = useTheme();
  return (
    <PressableScale
      testID={testID}
      onPress={onPress}
      accessibilityLabel={sub ? `${title}. ${sub}` : title}
      style={[styles.row, divider ? { borderBottomWidth: 1, borderColor: colors.hairline } : null]}
    >
      <View style={[styles.icon, { backgroundColor: colors.accents[accent].tint }]}>
        <Icon size={18} color={colors.accents[accent].base} strokeWidth={2} />
      </View>
      <View style={styles.text}>
        <Text variant="body" weight={600}>
          {title}
        </Text>
        {sub ? (
          <Text variant="caption" tone="secondary" num numberOfLines={1}>
            {sub}
          </Text>
        ) : null}
      </View>
      <ChevronRight size={18} color={colors.textSecondary} strokeWidth={2} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, paddingVertical: 10 },
  icon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, minWidth: 0, gap: 2 },
});
