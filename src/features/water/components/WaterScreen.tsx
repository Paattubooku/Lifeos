import { useRouter } from 'expo-router';
import { AlertTriangle, Undo2 } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { useNow } from '@/features/today/hooks/useNow';
import { shortDay } from '@/features/today/lib/present';
import { istClock } from '@/lib/dates';
import { formatClock, formatIndianNumber } from '@/lib/format';
import {
  Banner,
  Button,
  Card,
  ListRow,
  PressableScale,
  Ring,
  Screen,
  StatTile,
  Text,
  useTheme,
} from '@/ui';

import { useLogWater } from '../hooks/useLogWater';
import { useWater } from '../hooks/useWater';
import { showBehind } from '../lib/copy';
import { CustomAmount } from './CustomAmount';
import { WeekBars } from './WeekBars';

const QUICK = [200, 500, 750] as const;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Water design: ring with pace tick, behind banner, quick adds, custom, today's log, stats, 7 days. */
export function WaterScreen({ now: fixedNow }: { now?: number } = {}) {
  const ticking = useNow();
  const now = fixedNow ?? ticking;
  const router = useRouter();
  const { colors } = useTheme();
  const w = useWater(now);
  const { log, remove } = useLogWater();
  const add = (ml: number) =>
    void log(ml, { today: w.today, totalBefore: w.totalMl, targetMl: w.targetMl });
  const pct = w.targetMl > 0 ? Math.round((w.totalMl / w.targetMl) * 100) : 0;
  const nowClock = istClock(now);
  const left = Math.max(0, w.targetMl - w.totalMl);
  const pacing = w.pace.status === 'behind' || w.pace.status === 'on_track';

  return (
    <Screen
      title="Water"
      withTabBar={false}
      back={{ label: 'Today', onPress: () => router.back() }}
      action={
        <Text variant="sub" tone="secondary">
          {`${shortDay(w.today)} · ${formatClock(nowClock)}`}
        </Text>
      }
    >
      <View style={styles.ringWrap}>
        <Ring
          size={260}
          strokeWidth={22}
          accent="water"
          progress={w.targetMl > 0 ? w.totalMl / w.targetMl : 0}
          marker={pacing && w.targetMl > 0 ? w.pace.expected / w.targetMl : undefined}
          accessibilityLabel={`Water ${formatIndianNumber(w.totalMl)} of ${formatIndianNumber(w.targetMl)} ml, ${pct} percent`}
        >
          <View style={styles.center}>
            <Text variant="hero" num>
              {formatIndianNumber(w.totalMl)}
            </Text>
            <Text variant="sub" tone="secondary" num>
              {`of ${formatIndianNumber(w.targetMl)} ml · ${pct}%`}
            </Text>
            <Text variant="caption" tone="secondary" num>
              {left > 0
                ? `${formatIndianNumber(left)} ml left by ${formatClock(w.targetTime)}`
                : 'Goal hit'}
            </Text>
          </View>
        </Ring>
      </View>
      {pacing ? (
        <Text variant="caption" tone="secondary" align="center">
          {`White tick = pace for ${formatClock(nowClock)} (${formatIndianNumber(w.pace.expected)} ml). Pace runs ${formatClock(w.wakeTime)} → ${formatClock(w.targetTime)}.`}
        </Text>
      ) : null}

      {showBehind(w.pace) ? (
        <Banner
          tone="danger"
          icon={AlertTriangle}
          title={`${formatIndianNumber(w.pace.gap)} ml behind. Drink ${w.pace.suggested} ml now.`}
          action={{
            label: `Drink ${w.pace.suggested} ml`,
            accessibilityLabel: `Drink ${w.pace.suggested} ml now`,
            onPress: () => add(w.pace.suggested),
          }}
          testID="behind-banner"
        />
      ) : null}

      <View style={styles.quick}>
        {QUICK.map((ml) => (
          <PressableScale
            key={ml}
            accessibilityLabel={`Add ${ml} ml`}
            onPress={() => add(ml)}
            style={[styles.tile, { backgroundColor: colors.raised, borderColor: colors.hairline }]}
          >
            <Text variant="metric" tone="water" num>{`+${ml}`}</Text>
            <Text variant="caption" tone="secondary">
              ml
            </Text>
          </PressableScale>
        ))}
      </View>

      <Card>
        <View style={styles.head}>
          <Text variant="heading">Custom</Text>
          <Text variant="caption" tone="secondary">
            50 ml steps
          </Text>
        </View>
        <CustomAmount onAdd={add} />
      </Card>

      <Card padding={14} gap={4} testID="water-log">
        <View style={styles.head}>
          <Text variant="heading">Today’s log</Text>
          <Text variant="caption" tone="secondary">
            {w.entries.length === 0
              ? 'Nothing yet'
              : `${w.entries.length} entr${w.entries.length === 1 ? 'y' : 'ies'} · swipe left to delete`}
          </Text>
        </View>
        {w.entries.map((e) => (
          <ListRow
            key={e.client_id}
            testID={`water-${e.client_id}`}
            title={formatClock(istClock(e.logged_at))}
            meta={`${formatIndianNumber(e.amount_ml)} ml`}
            onDelete={() => void remove(e)}
          />
        ))}
        {w.entries.length > 0 ? (
          <Button
            variant="ghost"
            size="sm"
            icon={Undo2}
            label="Undo last"
            accessibilityLabel={`Undo last entry, ${w.entries[0]!.amount_ml} ml`}
            onPress={() => void remove(w.entries[0]!)}
          />
        ) : null}
      </Card>

      <View style={styles.stats}>
        <StatTile
          label="Water streak"
          accent="water"
          value={`${w.stats.current} day${w.stats.current === 1 ? '' : 's'}`}
          sub={`≥ ${formatIndianNumber(w.targetMl)} ml/day`}
          style={styles.flex}
        />
        <StatTile
          label="Best streak"
          value={`${w.stats.best?.days ?? 0} days`}
          sub={
            w.stats.best
              ? `${MONTHS[Number(w.stats.best.end.slice(5, 7)) - 1]} ${w.stats.best.end.slice(0, 4)}`
              : '—'
          }
          style={styles.flex}
        />
        <StatTile
          label="7-day avg"
          value={formatIndianNumber(w.stats.avg7)}
          sub={`ml · goal ${formatIndianNumber(w.targetMl)}`}
          style={styles.flex}
        />
      </View>

      <Card>
        <View style={styles.head}>
          <Text variant="heading">Last 7 days</Text>
          <Text variant="caption" tone="secondary">{`Goal hit ${w.stats.hit7} of 7`}</Text>
        </View>
        <WeekBars days={w.stats.last7} goalMl={w.targetMl} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  ringWrap: { alignItems: 'center' },
  center: { alignItems: 'center', gap: 2 },
  quick: { flexDirection: 'row', gap: 10 },
  tile: { flex: 1, alignItems: 'center', paddingVertical: 16, borderRadius: 16, borderWidth: 1 },
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  stats: { flexDirection: 'row', gap: 8 },
  flex: { flex: 1 },
});
