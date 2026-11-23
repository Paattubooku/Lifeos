// Import each weight by path: the package index would bundle every weight + italic.
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { PlusJakartaSans_500Medium } from '@expo-google-fonts/plus-jakarta-sans/500Medium';
import { PlusJakartaSans_600SemiBold } from '@expo-google-fonts/plus-jakarta-sans/600SemiBold';
import { PlusJakartaSans_700Bold } from '@expo-google-fonts/plus-jakarta-sans/700Bold';
import { PlusJakartaSans_800ExtraBold } from '@expo-google-fonts/plus-jakarta-sans/800ExtraBold';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider as NavThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect, useMemo } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';

import { useAuthListener } from '@/features/auth/hooks/useAuthListener';
import { useOnboardingGate } from '@/features/profile/hooks/useOnboardingGate';
import { useSyncWorker } from '@/features/sync/hooks/useSyncWorker';
import { useAppSelector } from '@/store';
import { persistor, store } from '@/store/root';
import { SnackbarProvider, ThemeProvider, useTheme } from '@/ui';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

  // Fonts are bundled, so this is a few ms; a font error falls back to system fonts.
  if (!fontsLoaded && !fontError) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Provider store={store}>
        <PersistGate persistor={persistor} loading={null}>
          <ThemedRoot />
        </PersistGate>
      </Provider>
    </GestureHandlerRootView>
  );
}

function ThemedRoot() {
  const preference = useAppSelector((s) => s.app.themePreference);
  return (
    <ThemeProvider preference={preference}>
      <Navigator />
    </ThemeProvider>
  );
}

function Navigator() {
  const { scheme, colors } = useTheme();
  useAuthListener();
  useSyncWorker();
  const status = useAppSelector((s) => s.auth.status);
  const signedIn = status === 'signedIn';
  const gate = useOnboardingGate(signedIn);

  // Keep the splash up until fonts are in and the stored session is restored.
  useEffect(() => {
    if (status !== 'restoring') SplashScreen.hideAsync().catch(() => undefined);
  }, [status]);

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.canvas).catch(() => undefined);
  }, [colors.canvas]);

  const navTheme = useMemo(() => {
    const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: colors.accents.primary.text,
        background: colors.canvas,
        card: colors.raised,
        text: colors.text,
        border: colors.hairline,
      },
    };
  }, [scheme, colors]);

  return (
    <NavThemeProvider value={navTheme}>
      <SnackbarProvider>
        <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
        {status === 'restoring' ? null : signedIn && gate === 'loading' ? (
          <View
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.canvas,
            }}
            accessibilityLabel="Loading your profile"
          >
            <ActivityIndicator color={colors.accents.primary.base} />
          </View>
        ) : (
          <Stack
            screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas } }}
          >
            <Stack.Screen name="index" />
            <Stack.Protected guard={signedIn && gate === 'done'}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="settings/profile" />
              <Stack.Screen name="routine/index" />
              <Stack.Screen name="routine/[id]" />
              <Stack.Screen name="streaks" />
              <Stack.Screen name="dev/gallery" />
            </Stack.Protected>
            <Stack.Protected guard={signedIn && gate === 'onboard'}>
              <Stack.Screen name="onboarding/[step]" />
            </Stack.Protected>
            <Stack.Protected guard={!signedIn}>
              <Stack.Screen name="(auth)/sign-in" />
            </Stack.Protected>
          </Stack>
        )}
      </SnackbarProvider>
    </NavThemeProvider>
  );
}
