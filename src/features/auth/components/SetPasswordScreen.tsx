import { Lock } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppDispatch, useAppSelector } from '@/store';
import { Banner, Button, Text, TextField, useTheme } from '@/ui';

import { setNewPassword, signOut } from '../slice';

/** Opened from a password-reset email: choose a new password before anything else. */
export function SetPasswordScreen() {
  const dispatch = useAppDispatch();
  const { pending, error } = useAppSelector((s) => s.auth);
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const message = formError ?? error;

  const save = () => {
    if (password.length < 8) return setFormError('Use at least 8 characters.');
    if (confirm !== password) return setFormError('The two passwords don’t match.');
    setFormError(null);
    void dispatch(setNewPassword({ password }));
  };

  return (
    <View style={[styles.flex, { backgroundColor: colors.canvas }]}>
      {/* Native keyboard insets: no JS relayout each time the suggestion bar changes height. */}
      <ScrollView
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        keyboardDismissMode="interactive"
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 64, paddingBottom: insets.bottom + 24 },
        ]}
      >
        <View style={styles.titles}>
          <Text variant="title" accessibilityRole="header">
            Set a new password
          </Text>
          <Text variant="body" tone="secondary">
            You opened a reset link. Choose a new password to continue.
          </Text>
        </View>
        <View style={styles.form}>
          <TextField
            label="New password"
            icon={Lock}
            secure
            value={password}
            onChangeText={(t) => {
              setPassword(t);
              setFormError(null);
            }}
            autoCapitalize="none"
            autoComplete="off"
            textContentType="oneTimeCode"
            editable={!pending}
          />
          <TextField
            label="Confirm new password"
            icon={Lock}
            secure
            value={confirm}
            onChangeText={(t) => {
              setConfirm(t);
              setFormError(null);
            }}
            autoCapitalize="none"
            autoComplete="off"
            textContentType="oneTimeCode"
            returnKeyType="go"
            onSubmitEditing={save}
            editable={!pending}
          />
          {message ? <Banner tone="danger" title={message} /> : null}
          <Button
            size="lg"
            fullWidth
            label={pending ? 'Saving…' : 'Save password'}
            accessibilityLabel="Save new password"
            disabled={pending}
            onPress={save}
          />
          <Button
            variant="ghost"
            fullWidth
            label="Cancel and sign out"
            accessibilityLabel="Cancel and sign out"
            disabled={pending}
            onPress={() => void dispatch(signOut())}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 16, gap: 32 },
  titles: { gap: 8 },
  form: { gap: 16 },
});
