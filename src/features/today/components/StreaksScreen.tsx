import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { isoWeekday } from '@/lib/dates';
import { Card, Screen, StatTile, Text, useTheme, withAlpha } from '@/ui';

import { useNow } from '../hooks/useNow';
import { useStreak } from '../hooks/useStreak';
import { useToday } from '../hooks/useToday';
import { dayMonth, shortDay } from '../lib/present';
import { averageScore, type HeatBand, type HeatCell, heatmap, lastBreak } from '../lib/streak';

const LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const LEGEND: { band: HeatBand; label: string }[] = [
  { band: 'lt50', label: '<50' },
  { band: '50to69', label: '50–69' },
  { band: '70to79', label: '70–79' },
  { band: '80to89', label: '80–89' },
  { band: '90plus', label: '90+' },
];

/** Prog-Streaks design: current / best / grace, 30-day heatmap, last break, the rules. */
export function StreaksScreen({ now: fixedNow }: { now?: number } = {}) {
  const ticking = useNow(60_000);
  const now = fixedNow ?? ticking;
  const router = useRouter();
  const { colors } = useTheme();
  const t = useToday(now);
  const todayScore = t.plan.blocks.length > 0 ? t.day.score.score : null;
  const { rows, streak } = useStreak(t.today, todayScore);
  const cells = heatmap(rows, t.today, todayScore, streak.graceDays);
  const avg = averageScore(cells);
  const broke = lastBreak(rows, t.today);

  const bandColor = (band: HeatBand): string => {
    const p = colors.accents.primary.base;
    switch (band) {
      case 'lt50':
        return colors.accents.danger.base;
      case '50to69':
        return colors.accents.calories.base;
      case '70to79':
        return withAlpha(p, 0.25);
      case '80to89':
        return withAlpha(p, 0.5);
      case '90plus':
        return colors.buttonPrimary;
      default:
        return colors.recessed;
    }
  };

  // Calendar rows starting Monday; blanks before the first day.
  const lead = isoWeekday(cells[0]!.date) - 1;
  const slots: (HeatCell | null)[] = [...Array<null>(lead).fill(null), ...cells];
  const weeks: (HeatCell | null)[][] = [];
  for (let i = 0; i < slots.length; i += 7) weeks.push(slots.slice(i, i + 7));

  return (
    <Screen
      title="Streaks"
      subtitle={`30 days · ${dayMonth(cells[0]!.date)} – ${dayMonth(t.today)}`}
      withTabBar={false}
      back={{ label: 'Today', onPress: () => router.back() }}
    >
      <View style={styles.tiles}>
        <StatTile
          label="Current"
          accent="success"
          value={String(streak.current)}
          sub={streak.since ? `days · since ${dayMonth(streak.since)}` : 'days'}
          style={styles.tile}
        />
        <StatTile
          label="Best"
          value={String(streak.best?.length ?? 0)}
          sub={
            streak.best
              ? `${dayMonth(streak.best.from)} – ${dayMonth(streak.best.to)}`
              : 'no streak yet'
          }
          style={styles.tile}
        />
        <StatTile
          label="Grace"
          accent="calories"
          value={streak.graceAvailable ? '1 left' : '1 used'}
          sub={
            streak.lastGrace
              ? `${shortDay(streak.lastGrace)} · ${rows.find((r) => r.date === streak.lastGrace)?.score ?? ''}%`
              : 'none used'
          }
          style={styles.tile}
        />
      </View>

      <Card kicker="Daily score" testID="heatmap">
        <Text variant="caption" tone="secondary" style={styles.avg}>
          {avg === null ? 'No scores yet' : `30-day avg ${avg}%`}
        </Text>
        <View style={styles.week}>
          {LETTERS.map((l, i) => (
            <Text
              key={i}
              variant="caption"
              tone="secondary"
              weight={600}
              align="center"
              style={styles.cellWidth}
            >
              {l}
            </Text>
          ))}
        </View>
        {weeks.map((week, wi) => (
          <View key={wi} style={styles.week}>
            {week.map((c, i) =>
              c ? (
                <View
                  key={c.date}
                  accessible
                  accessibilityLabel={`${shortDay(c.date)}: ${c.score === null ? 'no score' : `${c.score}%`}${c.grace ? ', grace day' : ''}${c.today ? ', today' : ''}`}
                  style={[
                    styles.cell,
                    styles.cellWidth,
                    { backgroundColor: bandColor(c.band) },
                    c.today ? { borderWidth: 2, borderColor: colors.text } : null,
                  ]}
                >
                  <Text
                    variant="sub"
                    weight={700}
                    num
                    tone={c.band === 'none' ? 'secondary' : 'default'}
                  >
                    {String(Number(c.date.slice(8)))}
                  </Text>
                  <Text variant="caption" num tone="secondary">
                    {c.score === null ? '–' : String(c.score)}
                  </Text>
                  {c.grace ? (
                    <View style={[styles.graceDot, { backgroundColor: colors.text }]} />
                  ) : null}
                </View>
              ) : (
                <View key={`blank-${i}`} style={styles.cellWidth} />
              ),
            )}
          </View>
        ))}
        <View style={styles.legend}>
          {LEGEND.map((l) => (
            <View key={l.band} style={styles.legendItem}>
              <View style={[styles.swatch, { backgroundColor: bandColor(l.band) }]} />
              <Text variant="caption" tone="secondary">
                {l.label}
              </Text>
            </View>
          ))}
          <View style={styles.legendItem}>
            <View style={[styles.swatch, styles.ring, { borderColor: colors.text }]} />
            <Text variant="caption" tone="secondary">
              grace
            </Text>
          </View>
        </View>
      </Card>

      {broke ? (
        <Card kicker="What broke the last one">
          <Text variant="body">
            <Text variant="body" weight={700}>
              {`${shortDay(broke.date)} · ${broke.score}%.`}
            </Text>
            {' Under 50 ends the run.'}
          </Text>
        </Card>
      ) : null}

      <Card kicker="How streaks work">
        <Text variant="body">
          A day counts at <Text weight={700}>70%+</Text>. One grace day per 14 days keeps the streak
          alive if the score is 50–69. Under 50 breaks it, no exceptions. Today never breaks it
          until the day ends at 3 am.
        </Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  tiles: { flexDirection: 'row', gap: 8 },
  tile: { flex: 1 },
  avg: { position: 'absolute', right: 16, top: 16 },
  week: { flexDirection: 'row', justifyContent: 'space-between', gap: 4 },
  cellWidth: { flex: 1 },
  cell: { aspectRatio: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  graceDot: { position: 'absolute', top: 3, right: 3, width: 6, height: 6, borderRadius: 3 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  swatch: { width: 12, height: 12, borderRadius: 3 },
  ring: { borderWidth: 1.5, borderRadius: 6 },
});
