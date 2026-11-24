import { useRouter } from 'expo-router';
import {
  Bell,
  CalendarDays,
  ChartColumn,
  Check,
  CircleCheck,
  Droplet,
  Dumbbell,
  Footprints,
  type LucideIcon,
  Moon,
  Scale,
  Soup,
  Sparkles,
  Wallet,
} from 'lucide-react-native';
import { useRef, useState } from 'react';
import {
  FlatList,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useProfile } from '@/features/profile/hooks/useProfileData';
import { applyWrites } from '@/features/profile/slice';
import { useAppDispatch } from '@/store';
import { Button, Card, Text, useTheme } from '@/ui';

import { clampIndex, TOUR, type TourIcon, type TourSlide } from '../lib/slides';

const ICONS: Record<TourIcon, LucideIcon> = {
  sparkles: Sparkles,
  calendar: CalendarDays,
  droplet: Droplet,
  soup: Soup,
  dumbbell: Dumbbell,
  scale: Scale,
  moon: Moon,
  footprints: Footprints,
  wallet: Wallet,
  chart: ChartColumn,
  bell: Bell,
  check: CircleCheck,
};

/**
 * The app tour: shown once after first-run setup (until finished or skipped),
 * and any time from More → App tour. Swipe or use Back / Next.
 */
export function TourScreen() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const { profile } = useProfile();
  const list = useRef<FlatList<TourSlide>>(null);
  const [index, setIndex] = useState(0);
  const last = index === TOUR.length - 1;

  const go = (i: number) => {
    const next = clampIndex(i);
    setIndex(next);
    list.current?.scrollToIndex({ index: next, animated: !reduceMotion });
  };

  const finish = async () => {
    if (profile && !profile.tour_seen_at) {
      await dispatch(
        applyWrites([
          {
            table: 'profile',
            clientId: profile.client_id,
            row: { tour_seen_at: new Date().toISOString() },
          },
        ]),
      );
    }
    if (router.canGoBack()) router.back();
    else router.replace('/today');
  };

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setIndex(clampIndex(Math.round(e.nativeEvent.contentOffset.x / Math.max(width, 1))));
  };

  return (
    <View style={[styles.flex, { backgroundColor: colors.canvas, paddingTop: insets.top + 8 }]}>
      <View style={styles.top}>
        <View
          style={styles.dots}
          accessible
          accessibilityLabel={`Page ${index + 1} of ${TOUR.length}`}
        >
          {TOUR.map((s, i) => (
            <View
              key={s.id}
              style={[
                styles.dot,
                i === index && styles.dotActive,
                { backgroundColor: i <= index ? colors.buttonPrimary : colors.border },
              ]}
            />
          ))}
        </View>
        {last ? (
          <View style={styles.skip} />
        ) : (
          <Button
            size="sm"
            variant="ghost"
            label="Skip"
            accessibilityLabel="Skip the tour"
            onPress={() => void finish()}
            style={styles.skip}
          />
        )}
      </View>

      <FlatList
        ref={list}
        data={TOUR}
        keyExtractor={(s) => s.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        renderItem={({ item }) => <Page slide={item} width={width} />}
        testID="tour-pager"
      />

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
        {index > 0 ? (
          <Button
            variant="ghost"
            label="Back"
            accessibilityLabel="Previous page"
            onPress={() => go(index - 1)}
            style={styles.back}
          />
        ) : null}
        <Button
          size="lg"
          label={last ? 'Start my day' : 'Next'}
          accessibilityLabel={last ? 'Finish the tour and start my day' : 'Next page'}
          onPress={() => (last ? void finish() : go(index + 1))}
          style={styles.flex}
        />
      </View>
    </View>
  );
}

function Page({ slide, width }: { slide: TourSlide; width: number }) {
  const { colors } = useTheme();
  const accent = colors.accents[slide.accent];
  const Icon = ICONS[slide.icon];
  return (
    <View style={[styles.page, { width }]} testID={`tour-${slide.id}`}>
      <View style={[styles.badge, { backgroundColor: accent.tint }]}>
        <Icon size={34} color={accent.base} strokeWidth={2} />
      </View>
      <View style={styles.titles}>
        <Text variant="kicker" tone="secondary">
          {slide.where}
        </Text>
        <Text variant="title" accessibilityRole="header">
          {slide.title}
        </Text>
        <Text variant="body" tone="secondary">
          {slide.body}
        </Text>
      </View>
      <Card kicker="How to use it" gap={10}>
        {slide.how.map((line) => (
          <View key={line} style={styles.howRow}>
            <Check size={16} color={accent.base} strokeWidth={2.5} style={styles.howIcon} />
            <Text variant="sub" style={styles.flex}>
              {line}
            </Text>
          </View>
        ))}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, minHeight: 44 },
  dots: { flex: 1, flexDirection: 'row', gap: 5, flexWrap: 'wrap' },
  dot: { width: 6, height: 6, borderRadius: 3 },
  dotActive: { width: 18 },
  skip: { minWidth: 64 },
  page: { paddingHorizontal: 16, paddingTop: 24, gap: 20 },
  badge: {
    width: 72,
    height: 72,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titles: { gap: 8 },
  howRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  howIcon: { marginTop: 2 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16 },
  back: { minWidth: 88 },
});
