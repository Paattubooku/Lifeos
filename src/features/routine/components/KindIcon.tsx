import { Check, Droplet, Dumbbell, type LucideIcon, Moon, Soup, Sun } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { type Accent, useTheme } from '@/ui';

import { type KindGroup, kindGroup } from '../lib/blocks';

export const KIND_ICON: Record<KindGroup, LucideIcon> = {
  habit: Sun,
  water: Droplet,
  workout: Dumbbell,
  meal: Soup,
  sleep: Moon,
  task: Check,
};

const KIND_ACCENT: Record<KindGroup, Accent | null> = {
  habit: 'primary',
  water: 'water',
  workout: 'protein',
  meal: 'calories',
  sleep: null,
  task: 'primary',
};

/** 32 px tinted square with the kind's icon (Routine-Blocks design). */
export function KindIcon({ kind, size = 32 }: { kind: string; size?: number }) {
  const { colors } = useTheme();
  const group = kindGroup(kind);
  const Icon = KIND_ICON[group];
  const accent = KIND_ACCENT[group];
  return (
    <View
      style={[
        styles.box,
        {
          width: size,
          height: size,
          backgroundColor: accent ? colors.accents[accent].tint : colors.recessed,
        },
      ]}
    >
      <Icon
        size={size * 0.5}
        color={accent ? colors.accents[accent].base : colors.textSecondary}
        strokeWidth={2}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
});
