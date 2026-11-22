import { type ComponentRef, useEffect, useRef } from 'react';
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { type Clock12, from12h, to12h } from '@/lib/format';

import { haptics } from './haptics';
import { Text } from './Text';
import { useTheme } from './ThemeProvider';
import { cardShadow, radius } from './theme';

export type TimePickerProps = {
  /** "HH:mm", 24 h (storage format). */
  value: string;
  onChange: (value: string) => void;
  /** e.g. "Wake time". */
  accessibilityLabel: string;
  minuteStep?: 1 | 5 | 10 | 15;
  testID?: string;
};

const ROW = 40;
const VISIBLE = 5;

/** Wheel picker: hour · minute · am/pm, recessed selection band (Components-1). */
export function TimePicker({
  value,
  onChange,
  accessibilityLabel,
  minuteStep = 5,
  testID,
}: TimePickerProps) {
  const { colors, scheme } = useTheme();
  const clock = to12h(value);
  // Snap an off-step minute (e.g. 05:07) to the nearest option for display.
  const minuteOptions = Array.from({ length: 60 / minuteStep }, (_, i) => i * minuteStep);
  const minuteIndex = Math.round(clock.minute / minuteStep) % minuteOptions.length;

  const set = (patch: Partial<Clock12>) => {
    const next = from12h({ ...clock, minute: minuteOptions[minuteIndex] ?? 0, ...patch });
    if (next !== value) {
      haptics.tap();
      onChange(next);
    }
  };

  return (
    <View
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.box,
        { backgroundColor: colors.raised, borderColor: colors.hairline },
        cardShadow(scheme),
      ]}
    >
      <View pointerEvents="none" style={[styles.band, { backgroundColor: colors.recessed }]} />
      <Wheel
        label={`${accessibilityLabel} hour`}
        options={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((h) => ({ key: h, text: String(h) }))}
        selectedIndex={clock.hour - 1}
        onSelect={(i) => set({ hour: i + 1 })}
      />
      <Wheel
        label={`${accessibilityLabel} minute`}
        options={minuteOptions.map((m) => ({ key: m, text: String(m).padStart(2, '0') }))}
        selectedIndex={minuteIndex}
        onSelect={(i) => set({ minute: minuteOptions[i] ?? 0 })}
      />
      <Wheel
        label={`${accessibilityLabel} am or pm`}
        options={[
          { key: 'am', text: 'am' },
          { key: 'pm', text: 'pm' },
        ]}
        selectedIndex={clock.period === 'am' ? 0 : 1}
        onSelect={(i) => set({ period: i === 0 ? 'am' : 'pm' })}
      />
    </View>
  );
}

function Wheel({
  label,
  options,
  selectedIndex,
  onSelect,
}: {
  label: string;
  options: { key: string | number; text: string }[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}) {
  const { colors } = useTheme();
  const ref = useRef<ComponentRef<typeof ScrollView>>(null);

  useEffect(() => {
    ref.current?.scrollTo({ y: selectedIndex * ROW, animated: false });
  }, [selectedIndex]);

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.y / ROW);
    const clamped = Math.max(0, Math.min(options.length - 1, i));
    if (clamped !== selectedIndex) onSelect(clamped);
  };

  const step = (d: 1 | -1) => {
    const i = selectedIndex + d;
    if (i >= 0 && i < options.length) onSelect(i);
  };

  return (
    <View
      style={styles.wheel}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ text: options[selectedIndex]?.text ?? '' }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => step(e.nativeEvent.actionName === 'increment' ? 1 : -1)}
    >
      <ScrollView
        ref={ref}
        testID={`wheel ${label}`}
        showsVerticalScrollIndicator={false}
        snapToInterval={ROW}
        decelerationRate="fast"
        contentContainerStyle={{ paddingVertical: ROW * ((VISIBLE - 1) / 2) }}
        onMomentumScrollEnd={onScrollEnd}
        onScrollEndDrag={(e) => {
          // Android may not fire momentum end for a slow drag.
          if (Math.abs(e.nativeEvent.velocity?.y ?? 0) < 0.05) onScrollEnd(e);
        }}
      >
        {options.map((opt, i) => {
          const dist = Math.abs(i - selectedIndex);
          const selected = dist === 0;
          return (
            <Pressable
              key={opt.key}
              accessibilityLabel={`${label} ${opt.text}`}
              accessibilityState={{ selected }}
              onPress={() => onSelect(i)}
              style={styles.row}
            >
              <Text
                variant={selected ? 'heading' : 'body'}
                num
                style={{
                  color: selected ? colors.text : colors.textSecondary,
                  opacity: selected ? 1 : dist === 1 ? 0.7 : 0.35,
                  fontSize: selected ? 22 : 16,
                }}
              >
                {opt.text}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    borderRadius: radius.card,
    borderWidth: 1,
    height: ROW * VISIBLE,
    overflow: 'hidden',
  },
  band: {
    position: 'absolute',
    left: 8,
    right: 8,
    top: ROW * ((VISIBLE - 1) / 2),
    height: ROW,
    borderRadius: radius.button,
  },
  wheel: { flex: 1 },
  row: { height: ROW, alignItems: 'center', justifyContent: 'center' },
});
