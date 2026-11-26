import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { AppState, Keyboard, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Text, TextField, useTheme } from '@/ui';

/**
 * Development-only: finds out why text boxes lose focus on a device. Three boxes
 * from bare to the app's own, and a timeline of focus, blur, keyboard and app
 * state events. If even box 1 loses focus, the cause is outside LifeOS code.
 */
export function KeyboardTestScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [start] = useState(() => Date.now());
  const [events, setEvents] = useState<string[]>([]);
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [c, setC] = useState('');

  const log = (e: string) => {
    const line = `+${((Date.now() - start) / 1000).toFixed(2)}s ${e}`;
    // Printed in the Metro terminal too, so it can be copied.
    console.log(`[LifeOS keyboard] ${line}`);
    setEvents((list) => [line, ...list].slice(0, 30));
  };

  useEffect(() => {
    const subs = [
      Keyboard.addListener('keyboardWillShow', () => log('keyboard will show')),
      Keyboard.addListener('keyboardDidShow', () => log('keyboard shown')),
      Keyboard.addListener('keyboardWillHide', () => log('keyboard will hide')),
      Keyboard.addListener('keyboardDidHide', () => log('keyboard hidden')),
      AppState.addEventListener('change', (s) => log(`app state: ${s}`)),
    ];
    return () => subs.forEach((s) => s.remove());
    // Subscribe once; `log` only appends to state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const plain = {
    borderWidth: 1,
    borderColor: colors.hairline,
    color: colors.text,
    backgroundColor: colors.raised,
    height: 48,
    paddingHorizontal: 12,
    borderRadius: 10,
  };

  return (
    <View style={[styles.flex, { backgroundColor: colors.canvas, paddingTop: insets.top + 8 }]}>
      <View style={styles.pad}>
        <Text variant="heading" accessibilityRole="header">
          Keyboard test
        </Text>
        <Text variant="caption" tone="secondary">
          Tap each box and type a few letters. Then copy the “[LifeOS keyboard]” lines from the
          terminal.
        </Text>
        <Text variant="sub" weight={600}>
          1 · Plain box (no LifeOS components)
        </Text>
        <TextInput
          value={a}
          onChangeText={setA}
          placeholder="Type here"
          placeholderTextColor={colors.textSecondary}
          accessibilityLabel="Plain test box"
          onFocus={() => log('box 1 focus')}
          onBlur={() => log('box 1 blur')}
          style={plain}
        />
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.pad}>
        <Text variant="sub" weight={600}>
          2 · Plain box inside a scroll view
        </Text>
        <TextInput
          value={b}
          onChangeText={setB}
          placeholder="Type here"
          placeholderTextColor={colors.textSecondary}
          accessibilityLabel="Scroll test box"
          onFocus={() => log('box 2 focus')}
          onBlur={() => log('box 2 blur')}
          style={plain}
        />
        <TextField
          label="3 · The app’s text field"
          value={c}
          onChangeText={setC}
          placeholder="Type here"
          onFocus={() => log('box 3 focus')}
          onBlur={() => log('box 3 blur')}
        />
        <Button
          size="sm"
          variant="ghost"
          label="Back"
          accessibilityLabel="Back"
          onPress={() => router.back()}
        />
        <Text variant="sub" weight={600}>
          Timeline (newest first)
        </Text>
        {events.map((e, i) => (
          <Text key={`${i}-${e}`} variant="caption" num>
            {e}
          </Text>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pad: { paddingHorizontal: 16, paddingBottom: 12, gap: 10 },
});
