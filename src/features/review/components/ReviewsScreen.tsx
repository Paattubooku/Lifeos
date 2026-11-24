import { useRouter } from 'expo-router';
import { NotebookPen } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { useNow } from '@/features/today/hooks/useNow';
import { dayMonth } from '@/features/today/lib/present';
import { addDays, logicalDate } from '@/lib/dates';
import { Button, Card, EmptyState, Screen, StatusChip, Text } from '@/ui';

import { useReviews } from '../hooks/useReview';
import { reviewWeek, type Summary, weekLabel } from '../lib/review';

/** Past weekly reviews (PRD F20 AC: listed in Progress), newest first. */
export function ReviewsScreen({ now: fixedNow }: { now?: number } = {}) {
  const ticking = useNow(60_000);
  const now = fixedNow ?? ticking;
  const router = useRouter();
  const reviews = useReviews();
  const due = reviewWeek(logicalDate(now));
  const done = reviews.some((r) => r.week_start === due);
  return (
    <Screen
      title="Weekly reviews"
      subtitle={`${reviews.length} ${reviews.length === 1 ? 'review' : 'reviews'} · Sundays at 8:00 pm`}
      withTabBar={false}
      back={{ label: 'Progress', onPress: () => router.back() }}
      action={
        <Button
          icon={NotebookPen}
          size="sm"
          label={done ? 'Edit' : 'Review'}
          accessibilityLabel={done ? 'Edit this week’s review' : 'Start the weekly review'}
          onPress={() => router.push('/review')}
        />
      }
    >
      {reviews.length === 0 ? (
        <Card>
          <EmptyState
            icon={NotebookPen}
            title="No reviews yet"
            body="Sunday at 8 pm: two minutes, one honest look back, one change forward."
            action={{
              label: 'Start a review',
              accessibilityLabel: 'Start a review',
              onPress: () => router.push('/review'),
            }}
          />
        </Card>
      ) : (
        reviews.map((r) => {
          const s = (r.summary ?? {}) as Partial<Summary>;
          return (
            <Card key={r.client_id} padding={16} gap={6} testID={`review-${r.week_start}`}>
              <View style={styles.row}>
                <Text variant="kicker" tone="secondary" style={styles.flex}>
                  {`${weekLabel(r.week_start)} · ${dayMonth(r.week_start)}–${dayMonth(addDays(r.week_start, 6))}`}
                </Text>
                {r.grade ? (
                  <StatusChip
                    label={`${typeof s.avgScore === 'number' ? `${s.avgScore}% · ` : ''}${r.grade}`}
                    tone={r.grade === 'Needs work' ? 'danger' : 'neutral'}
                  />
                ) : null}
              </View>
              {r.went_well ? (
                <Text variant="sub">
                  <Text variant="sub" weight={700}>
                    {'Went well: '}
                  </Text>
                  {r.went_well}
                </Text>
              ) : null}
              {r.change_next_week ? (
                <Text variant="sub">
                  <Text variant="sub" weight={700}>
                    {'Change: '}
                  </Text>
                  {r.change_next_week}
                </Text>
              ) : null}
              {s.worst ? (
                <Text
                  variant="caption"
                  tone="secondary"
                >{`Worst block: ${s.worst.title} ${s.worst.pct}%`}</Text>
              ) : null}
            </Card>
          );
        })
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flex: { flex: 1 },
});
