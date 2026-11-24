import { Lock, Mail } from 'lucide-react-native';
import { type ComponentRef, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppDispatch, useAppSelector } from '@/store';
import { Banner, Button, Text, TextField, useSnackbar, useTheme } from '@/ui';

import { isValidEmail } from '../lib/session';
import { clearAuthError, sendPasswordReset, signIn, signUp } from '../slice';

type Mode = 'signIn' | 'signUp';

/** design/screens/SignIn(-Dark).png, plus "Create account" for new people (F25). */
export function SignInScreen() {
  const dispatch = useAppDispatch();
  const { pending, error, notice, configMissing } = useAppSelector((s) => s.auth);
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const showSnackbar = useSnackbar();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [mode, setMode] = useState<Mode>('signIn');
  const [formError, setFormError] = useState<string | null>(null);
  const passwordRef = useRef<ComponentRef<typeof TextInput>>(null);
  const confirmRef = useRef<ComponentRef<typeof TextInput>>(null);
  const creating = mode === 'signUp';

  const message = formError ?? error;

  const validate = (needPassword: boolean): boolean => {
    dispatch(clearAuthError());
    if (!isValidEmail(email)) {
      setFormError('Enter your email address.');
      return false;
    }
    if (needPassword && password.length === 0) {
      setFormError('Enter your password.');
      return false;
    }
    setFormError(null);
    return true;
  };

  const onSignIn = () => {
    if (validate(true)) void dispatch(signIn({ email, password }));
  };

  const onSignUp = () => {
    if (!validate(true)) return;
    if (password.length < 8) {
      setFormError('Use at least 8 characters.');
      return;
    }
    if (confirm !== password) {
      setFormError('The two passwords don’t match.');
      return;
    }
    void dispatch(signUp({ email, password }));
  };

  const switchMode = (next: Mode) => {
    dispatch(clearAuthError());
    setFormError(null);
    setConfirm('');
    setMode(next);
  };

  const onForgot = async () => {
    if (!validate(false)) return;
    const res = await dispatch(sendPasswordReset({ email }));
    if (sendPasswordReset.fulfilled.match(res)) {
      showSnackbar({ message: `Reset link sent to ${res.payload}` });
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: colors.canvas }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 64, paddingBottom: insets.bottom + 24 },
        ]}
      >
        <View style={styles.brand}>
          <View style={[styles.logo, { backgroundColor: colors.accents.primary.base }]}>
            <Text variant="heading" weight={800} tone="onButton">
              L/
            </Text>
          </View>
          <Text variant="title" accessibilityRole="header">
            LifeOS
          </Text>
          <Text variant="body" tone="secondary">
            {creating
              ? 'Create your account. Setup takes 2 minutes.'
              : 'Your whole day. One screen.'}
          </Text>
        </View>

        {configMissing ? (
          <Banner
            tone="danger"
            title="Supabase isn’t set up yet."
            body="Copy .env.example to .env, add the project URL and anon key, then restart Expo."
          />
        ) : null}

        <View style={styles.form}>
          <TextField
            label="Email"
            icon={Mail}
            value={email}
            onChangeText={(t) => {
              setEmail(t);
              setFormError(null);
            }}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            keyboardType="email-address"
            textContentType="username"
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
            editable={!pending}
          />
          <TextField
            ref={passwordRef}
            label="Password"
            icon={Lock}
            secure
            value={password}
            onChangeText={(t) => {
              setPassword(t);
              setFormError(null);
            }}
            autoCapitalize="none"
            autoComplete={creating ? 'new-password' : 'current-password'}
            textContentType={creating ? 'newPassword' : 'password'}
            returnKeyType={creating ? 'next' : 'go'}
            onSubmitEditing={creating ? () => confirmRef.current?.focus() : onSignIn}
            editable={!pending}
          />
          {creating ? (
            <TextField
              ref={confirmRef}
              label="Confirm password"
              icon={Lock}
              secure
              value={confirm}
              onChangeText={(t) => {
                setConfirm(t);
                setFormError(null);
              }}
              autoCapitalize="none"
              autoComplete="new-password"
              textContentType="newPassword"
              returnKeyType="go"
              onSubmitEditing={onSignUp}
              editable={!pending}
            />
          ) : null}

          {message ? <Banner tone="danger" title={message} testID="auth-error" /> : null}

          {notice ? <Banner tone="success" title={notice} testID="auth-notice" /> : null}

          {creating ? (
            <>
              <Button
                size="lg"
                fullWidth
                label={pending ? 'Creating…' : 'Create account'}
                accessibilityLabel="Create account"
                disabled={pending || configMissing}
                onPress={onSignUp}
              />
              <Button
                variant="ghost"
                fullWidth
                label="Have an account? Sign in"
                accessibilityLabel="Have an account? Sign in"
                disabled={pending}
                onPress={() => switchMode('signIn')}
              />
            </>
          ) : (
            <>
              <Button
                size="lg"
                fullWidth
                label={pending ? 'Signing in…' : 'Sign in'}
                accessibilityLabel="Sign in"
                disabled={pending || configMissing}
                onPress={onSignIn}
              />
              <Button
                variant="ghost"
                fullWidth
                label="Forgot password"
                accessibilityLabel="Forgot password"
                accessibilityHint="Sends a reset link to the email above"
                disabled={pending || configMissing}
                onPress={() => void onForgot()}
              />
              <Button
                variant="outline"
                fullWidth
                label="New here? Create an account"
                accessibilityLabel="New here? Create an account"
                disabled={pending || configMissing}
                onPress={() => switchMode('signUp')}
              />
            </>
          )}
        </View>

        <View style={styles.footer}>
          <Text variant="caption" tone="secondary" align="center">
            Private by default. No sharing, no feed.
          </Text>
          <Text variant="caption" tone="secondary" align="center">
            Your data syncs to your account only.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 16, gap: 32 },
  brand: { gap: 8 },
  logo: {
    width: 56,
    height: 56,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  form: { gap: 16 },
  footer: { marginTop: 'auto', gap: 2, paddingTop: 24 },
});
