import { Coffee } from 'lucide-react-native';
import { Pressable, StyleSheet } from 'react-native';

import { Text, useTheme } from '@/ui';

import { coffeeState } from '../lib/extras';

/** Food header chip "1/2": tap +1, hold −1. Grey under, amber at, red over the limit (Food-Coffee design). */
export function CoffeeChip({
  count,
  limit,
  onAdd,
  onRemove,
}: {
  count: number;
  limit: number;
  onAdd: () => void;
  onRemove: () => void;
}) {
  const { colors } = useTheme();
  const state = coffeeState(count, limit);
  const accent =
    state === 'over' ? colors.accents.danger : state === 'at' ? colors.accents.calories : null;
  return (
    <Pressable
      testID="coffee-chip"
      onPress={onAdd}
      onLongPress={onRemove}
      delayLongPress={350}
      accessibilityRole="button"
      accessibilityLabel={`Coffee ${count} of ${limit}${state === 'over' ? ', over the limit' : state === 'at' ? ', at the limit' : ''}`}
      accessibilityHint="Tap to add one, hold to remove one"
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: accent ? accent.tint : colors.recessed,
          borderColor: accent ? accent.base : colors.hairline,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <Coffee size={18} color={accent ? accent.base : colors.text} strokeWidth={2} />
      <Text variant="sub" weight={700} num style={{ color: accent ? accent.text : colors.text }}>
        {`${count}/${limit}`}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 44,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
  },
});
