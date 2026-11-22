import { useRouter } from 'expo-router';
import { Palette } from 'lucide-react-native';

import { useAppDispatch, useAppSelector } from '@/store';
import { setThemePreference } from '@/store/appSlice';
import { Button, Card, SegmentedToggle, Screen, Text, type ThemePreference } from '@/ui';

const THEME_OPTIONS = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
] as const satisfies readonly { value: ThemePreference; label: string }[];

export default function MoreScreen() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const preference = useAppSelector((s) => s.app.themePreference);

  return (
    <Screen title="More" subtitle="Routine, tasks, money and settings arrive from F04.">
      <Card kicker="Appearance" title="Theme">
        <SegmentedToggle
          accessibilityLabel="Theme"
          options={THEME_OPTIONS}
          value={preference}
          onChange={(v) => dispatch(setThemePreference(v))}
        />
        <Text variant="sub" tone="secondary">
          Default is Dark. System follows your phone.
        </Text>
      </Card>
      {__DEV__ ? (
        <Card kicker="Developer" title="Component gallery">
          <Text variant="sub" tone="secondary">
            Every src/ui component, to compare against design/screens/Components-*.png.
          </Text>
          <Button
            variant="secondary"
            icon={Palette}
            label="Open gallery"
            accessibilityLabel="Open component gallery"
            onPress={() => router.push('/dev/gallery')}
          />
        </Card>
      ) : null}
    </Screen>
  );
}
