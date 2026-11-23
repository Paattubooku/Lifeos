import { Flame } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { formatIndianNumber } from '@/lib/format';
import { type Accent, Card, Text, TripleRing, useTheme } from '@/ui';

export type ScoreCardProps = {
  score: number;
  done: number;
  counted: number;
  waterMl: number;
  waterTargetMl: number;
  proteinG: number;
  proteinTargetG: number;
  /** "12-day streak · 1 grace left" — opens Streaks. */
  streak?: { current: number; line: string; onPress: () => void };
};

const pct = (v: number, of: number) => (of > 0 ? Math.min(100, Math.round((v / of) * 100)) : 0);

/** Day score ring + routine / water / protein sub-stats (Today design; DESIGN_NOTES B1). */
export function ScoreCard(p: ScoreCardProps) {
  const { colors } = useTheme();
  const waterPct = pct(p.waterMl, p.waterTargetMl);
  const proteinPct = pct(p.proteinG, p.proteinTargetG);
  const stats: { label: string; value: string; sub: string; accent: Accent }[] = [
    { label: 'Routine', value: `${p.done} / ${p.counted}`, sub: `${p.score}%`, accent: 'primary' },
    {
      label: 'Water',
      value: `${formatIndianNumber(p.waterMl)} ml`,
      sub: `${waterPct}%`,
      accent: 'water',
    },
    { label: 'Protein', value: `${p.proteinG} g`, sub: `${proteinPct}%`, accent: 'protein' },
  ];
  return (
    <Card testID="score-card">
      <View style={styles.row}>
        <TripleRing
          size={148}
          accessibilityLabel={`Day score ${p.score}%. Routine ${p.done} of ${p.counted}. Water ${waterPct}%. Protein ${proteinPct}%.`}
          rings={[
            { progress: p.score / 100, accent: 'primary' },
            { progress: waterPct / 100, accent: 'water' },
            { progress: proteinPct / 100, accent: 'protein' },
          ]}
        >
          <View style={styles.center}>
            <Text variant="metric" num>
              {`${p.score}%`}
            </Text>
            <Text variant="caption" tone="secondary">
              day score
            </Text>
          </View>
        </TripleRing>
        <View style={styles.stats}>
          {stats.map((s) => (
            <View key={s.label} style={styles.stat}>
              <View style={styles.labelRow}>
                <View style={[styles.dot, { backgroundColor: colors.accents[s.accent].base }]} />
                <Text variant="kicker" tone="secondary">
                  {s.label}
                </Text>
              </View>
              <Text variant="heading" num>
                {s.value}
                <Text variant="caption" tone="secondary" num>
                  {` · ${s.sub}`}
                </Text>
              </Text>
            </View>
          ))}
        </View>
      </View>
      {p.streak ? (
        <Pressable
          onPress={p.streak.onPress}
          accessibilityRole="button"
          accessibilityLabel={`${p.streak.line}. Open streaks`}
          style={styles.streak}
        >
          <Flame size={16} color={colors.accents.success.base} strokeWidth={2.2} />
          <Text variant="sub" weight={700} tone="success">
            {p.streak.line.split(' · ')[0]}
          </Text>
          <Text variant="sub" tone="secondary" style={styles.flex} numberOfLines={1}>
            {`· ${p.streak.line.split(' · ').slice(1).join(' · ')}`}
          </Text>
        </Pressable>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  center: { alignItems: 'center' },
  stats: { flex: 1, gap: 10 },
  stat: { gap: 2 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  streak: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44 },
  flex: { flex: 1 },
});
