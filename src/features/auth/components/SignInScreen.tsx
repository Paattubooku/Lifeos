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

export type SignInScreenProps = {
  /** Dev-only account creation (EXPO_PUBLIC_ENABLE_SIGNUP=1 in a dev build). */
  allowSignUp: boolean;
};

/** design/screens/SignIn(-Dark).png */
export function SignInScreen({ allowSignUp }: SignInScreenProps) {
  const dispatch = useAppDispatch();
  const { pending, error, configMissing } = useAppSelector((s) => s.auth);
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const showSnackbar = useSnackbar();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const passwordRef = useRef<ComponentRef<typeof TextInput>>(null);

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
    void dispatch(signUp({ email, password }));
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
            5:00 am to 10:00 pm. One screen.
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
            autoComplete="current-password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={onSignIn}
            editable={!pending}
          />

          {message ? <Banner tone="danger" title={message} testID="auth-error" /> : null}

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
          {allowSignUp ? (
            <Button
              variant="outline"
              fullWidth
              label="Create account (dev)"
              accessibilityLabel="Create account, development only"
              disabled={pending || configMissing}
              onPress={onSignUp}
            />
          ) : null}
        </View>

        <View style={styles.footer}>
          <Text variant="caption" tone="secondary" align="center">
            Single account. No sign-up, no sharing.
          </Text>
          <Text variant="caption" tone="secondary" align="center">
            Data syncs to your account only.
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
