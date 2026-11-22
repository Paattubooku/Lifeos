import { Check } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';

import { haptics } from './haptics';
import { useTheme } from './ThemeProvider';
import { radius, TOUCH_MIN } from './theme';

export type CheckboxProps = {
  checked: boolean;
  onToggle: (next: boolean) => void;
  /** e.g. "Complete Pay electricity bill". */
  accessibilityLabel: string;
  testID?: string;
};

/** 24 px box in a 44×44 hit area; done = emerald fill with a pop-in tick. */
export function Checkbox({ checked, onToggle, accessibilityLabel, testID }: CheckboxProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="checkbox"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked }}
      onPress={() => {
        if (!checked) haptics.success();
        else haptics.tap();
        onToggle(!checked);
      }}
      style={styles.hit}
    >
      {checked ? (
        <Animated.View
          entering={ZoomIn.springify().damping(12)}
          style={[styles.box, { backgroundColor: colors.accents.success.base }]}
        >
          <Check size={16} color={colors.onButton} strokeWidth={3} />
        </Animated.View>
      ) : (
        <View style={[styles.box, styles.empty, { borderColor: colors.border }]} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hit: { width: TOUCH_MIN, height: TOUCH_MIN, alignItems: 'center', justifyContent: 'center' },
  box: {
    width: 24,
    height: 24,
    borderRadius: radius.checkbox,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: { borderWidth: 2 },
});
