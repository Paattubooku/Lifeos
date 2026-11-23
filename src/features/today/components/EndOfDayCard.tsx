import { BedDouble, PencilLine, Scale } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { Button, Card, Text } from '@/ui';

export type EndOfDayItem = { key: string; title: string; sub?: string };

export type EndOfDayCardProps = {
  score: number;
  items: readonly EndOfDayItem[];
  onLogWeight: () => void;
  onLogSleep: () => void;
  onNote: () => void;
  hasNote: boolean;
};

/** "78%. 3 things left." — shown from phone-off time (PRD F05, Today 9:30 pm design). */
export function EndOfDayCard(p: EndOfDayCardProps) {
  const n = p.items.length;
  const headline =
    n === 0
      ? `${p.score}%. Nothing left — good night.`
      : `${p.score}%. ${n} thing${n === 1 ? '' : 's'} left.`;
  return (
    <Card kicker="End of day" testID="end-of-day">
      <Text variant="heading" accessibilityRole="header">
        {headline}
      </Text>
      {p.items.map((item) => (
        <View key={item.key} style={styles.item}>
          <Text variant="body" weight={600}>
            {item.title}
          </Text>
          {item.sub ? (
            <Text variant="caption" tone="secondary">
              {item.sub}
            </Text>
          ) : null}
        </View>
      ))}
      <View style={styles.row}>
        <Button
          icon={Scale}
          label="Log weight"
          accessibilityLabel="Log weight"
          onPress={p.onLogWeight}
          style={styles.flex}
        />
        <Button
          variant="outline"
          icon={BedDouble}
          label="Log sleep"
          accessibilityLabel="Log sleep"
          onPress={p.onLogSleep}
          style={styles.flex}
        />
      </View>
      <Button
        variant="secondary"
        icon={PencilLine}
        label={p.hasNote ? 'Edit note' : 'Note'}
        accessibilityLabel={p.hasNote ? 'Edit today’s note' : 'Write a note'}
        onPress={p.onNote}
        fullWidth
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  item: { gap: 2 },
  row: { flexDirection: 'row', gap: 10 },
  flex: { flex: 1 },
});
