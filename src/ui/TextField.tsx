import { Eye, EyeOff, type LucideIcon } from 'lucide-react-native';
import { type ComponentRef, forwardRef, useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, type TextInputProps, View } from 'react-native';

import { devLog } from '@/lib/devLog';

import { Text } from './Text';
import { useTheme } from './ThemeProvider';
import { fonts, radius, TOUCH_MIN } from './theme';

export type TextFieldProps = Omit<TextInputProps, 'style' | 'secureTextEntry'> & {
  label: string;
  icon?: LucideIcon;
  /** Password field with a show/hide toggle. */
  secure?: boolean;
  error?: string | null;
  testID?: string;
};

/** Labelled input on the raised plane; cobalt border while focused (SignIn design). */
export const TextField = forwardRef<ComponentRef<typeof TextInput>, TextFieldProps>(
  function TextField({ label, icon: Icon, secure, error, testID, onFocus, onBlur, ...input }, ref) {
    const { colors } = useTheme();
    const [focused, setFocused] = useState(false);
    const [hidden, setHidden] = useState(true);
    useEffect(() => {
      devLog(`text box "${label}" built`);
      return () => devLog(`text box "${label}" removed`);
      // Mount / unmount only.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const borderColor = error
      ? colors.accents.danger.base
      : focused
        ? colors.accents.primary.base
        : colors.hairline;

    return (
      <View style={styles.wrap}>
        <Text variant="sub" weight={600}>
          {label}
        </Text>
        <View
          style={[
            styles.field,
            {
              backgroundColor: colors.raised,
              borderColor,
              // The shadow props are always set; only the opacity changes on focus.
              // Adding `shadowColor` only while focused makes React Native (new
              // architecture) rebuild this view as a new stacking context, which
              // re-parents the native text field and drops the keyboard on iPhone.
              shadowColor: colors.accents.primary.base,
              shadowOpacity: focused && !error ? 0.35 : 0,
              shadowRadius: 6,
              shadowOffset: { width: 0, height: 0 },
            },
          ]}
        >
          {Icon ? <Icon size={18} color={colors.textSecondary} strokeWidth={2} /> : null}
          <TextInput
            ref={ref}
            testID={testID}
            accessibilityLabel={label}
            accessibilityHint={error ?? undefined}
            placeholderTextColor={colors.textSecondary}
            selectionColor={colors.accents.primary.base}
            secureTextEntry={secure ? hidden : false}
            onFocus={(e) => {
              setFocused(true);
              onFocus?.(e);
            }}
            onBlur={(e) => {
              setFocused(false);
              onBlur?.(e);
            }}
            style={[styles.input, { color: colors.text }]}
            {...input}
          />
          {secure ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={hidden ? 'Show password' : 'Hide password'}
              onPress={() => setHidden((h) => !h)}
              hitSlop={4}
              style={styles.toggle}
            >
              {hidden ? (
                <Eye size={18} color={colors.textSecondary} strokeWidth={2} />
              ) : (
                <EyeOff size={18} color={colors.textSecondary} strokeWidth={2} />
              )}
            </Pressable>
          ) : null}
        </View>
        {error ? (
          <Text variant="caption" tone="danger">
            {error}
          </Text>
        ) : null}
      </View>
    );
  },
);

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 52,
    paddingLeft: 14,
    paddingRight: 4,
    borderRadius: radius.button,
    borderWidth: 1,
  },
  // outlineWidth: hides the browser focus ring in web dev checks; the border shows focus.
  input: {
    flex: 1,
    minHeight: 48,
    fontFamily: fonts.body[400],
    fontSize: 16,
    paddingVertical: 0,
    outlineWidth: 0,
  },
  toggle: { width: TOUCH_MIN, height: TOUCH_MIN, alignItems: 'center', justifyContent: 'center' },
});
