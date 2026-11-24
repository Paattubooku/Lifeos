import { useRouter } from 'expo-router';
import { MoonStar, Table2 } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { hhmm } from '@/features/routine/lib/blocks';
import { SleepSheet } from '@/features/today/components/LogSheets';
import { useNow } from '@/features/today/hooks/useNow';
import { useToday } from '@/features/today/hooks/useToday';
import { dayMonth, shortDay } from '@/features/today/lib/present';
import { istClock } from '@/lib/dates';
import { formatClock } from '@/lib/format';
import { Button, Card, MenuRow, Screen, StatTile, Text, useTheme } from '@/ui';

import { useLogNight } from '../hooks/useLogNight';
import { useSleep } from '../hooks/useSleep';
import { bedtimeLine, clockOffset, NIGHTS, offsetClock, TARGET_HOURS } from '../lib/sleep';
import { BedtimeStrip } from './BedtimeStrip';
import { MorningCheckCard } from './MorningCheckCard';
import { SleepBars } from './SleepBars';

/** `/sleep` (Prog-Sleep design, PRD F14). */
export function SleepScreen({ now: fixedNow }: { now?: number } = {}) {
  const ticking = useNow(60_000);
  const now = fixedNow ?? ticking;
  const router = useRouter();
  const { colors } = useTheme();
  const t = useToday(now);
  const sleep = useSleep(now);
  const logNight = useLogNight(t, sleep);
  const [adjusting, setAdjusting] = useState(false);
  const [table, setTable] = useState(false);
  const s = sleep.stats;
  const { bed, wake } = sleep.target;
  const phoneAway = hhmm(t.profile?.phone_off_time ?? '21:30');
  const dots = sleep.nights.flatMap((n) =>
    n.bedMin === null
      ? []
      : [{ offset: n.bedMin, clock: offsetClock(n.bedMin), detail: shortDay(n.date) }],
  );
  const last = sleep.lastNight;

  return (
    <Screen
      title="Sleep"
      subtitle={`Target ${formatClock(bed)} → ${formatClock(wake)} · ${TARGET_HOURS} h`}
      withTabBar={false}
      back={{ label: 'Progress', onPress: () => router.back() }}
      action={
        <Button
          icon={MoonStar}
          size="sm"
          variant="secondary"
          label="Log"
          accessibilityLabel="Log last night"
          onPress={() => setAdjusting(true)}
        />
      }
    >
      {sleep.check && !sleep.isLoading ? (
        <MorningCheckCard
          now={now}
          date={sleep.today}
          bed={sleep.check.bed}
          wake={sleep.check.wake}
          targetBed={bed}
          onCorrect={() => sleep.check && logNight(sleep.check.bed, sleep.check.wake)}
          onAdjust={() => setAdjusting(true)}
        />
      ) : null}

      <View style={styles.tiles}>
        <StatTile
          label="7-day avg"
          accent="primary"
          value={s.avg7 === null ? '—' : `${s.avg7} h`}
          sub={`target ${TARGET_HOURS} h`}
          style={styles.flex}
        />
        <StatTile
          label={`Nights ≥ ${TARGET_HOURS} h`}
          accent="success"
          value={`${s.atTarget} / ${NIGHTS}`}
          sub="last 2 weeks"
          style={styles.flex}
        />
        <StatTile
          label="Bedtime"
          accent="primary"
          value={s.bedSpread === null ? '—' : `±${s.bedSpread} min`}
          sub={s.bedAvg ? `avg ${formatClock(s.bedAvg)}` : 'log 2+ nights'}
          style={styles.flex}
        />
      </View>

      <Card kicker={`Hours slept · ${NIGHTS} nights`} testID="hours-card">
        {s.logged > 0 ? (
          <>
            <SleepBars
              bars={sleep.nights.map((n) => ({
                label: String(Number(n.date.slice(8))),
                hours: n.hours,
                detail: shortDay(n.date),
              }))}
            />
            <Button
              icon={Table2}
              size="sm"
              variant="ghost"
              label={table ? 'Hide table' : 'Show table'}
              accessibilityLabel={table ? 'Hide nights table' : 'Show nights table'}
              onPress={() => setTable((v) => !v)}
            />
            {table ? (
              <View testID="sleep-table">
                {[...sleep.nights].reverse().map((n) => (
                  <View key={n.date} style={[styles.tableRow, { borderColor: colors.hairline }]}>
                    <Text variant="sub" style={styles.flex}>
                      {dayMonth(n.date)}
                    </Text>
                    <Text variant="sub" tone="secondary" style={styles.flex}>
                      {n.bedMin === null ? '—' : `bed ${formatClock(offsetClock(n.bedMin))}`}
                    </Text>
                    <Text variant="sub" weight={700}>
                      {n.hours === null ? '—' : `${n.hours} h`}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
          </>
        ) : (
          <Text variant="sub" tone="secondary">
            Log a night to start the chart. The morning check asks after you wake.
          </Text>
        )}
      </Card>

      <Card
        kicker="Bedtime consistency"
        title={s.bedSpread === null ? undefined : `±${s.bedSpread} min`}
        testID="consistency-card"
      >
        {dots.length > 0 ? <BedtimeStrip dots={dots} target={clockOffset(bed)} /> : null}
        <Text variant="sub" tone="secondary" testID="consistency-text">
          {`${s.bedAvg ? `${bedtimeLine(s.bedAvg, bed, formatClock)} ` : ''}The ${formatClock(phoneAway)} phone-away block was done on ${s.phoneKept} of ${NIGHTS} nights.`}
        </Text>
      </Card>

      <Card padding={14} gap={0}>
        <MenuRow
          icon={MoonStar}
          title="Screen Time setup"
          sub="Downtime / Bedtime mode on your phone"
          onPress={() => router.push('/settings/screen-time')}
        />
      </Card>

      {last?.bed_at && last.wake_at ? (
        <Text variant="caption" tone="secondary">
          {`Last night: ${formatClock(istClock(last.bed_at))} → ${formatClock(istClock(last.wake_at))}`}
        </Text>
      ) : null}

      {adjusting ? (
        <SleepSheet
          visible
          initialBed={last?.bed_at ? istClock(last.bed_at) : (sleep.check?.bed ?? bed)}
          initialWake={last?.wake_at ? istClock(last.wake_at) : (sleep.check?.wake ?? wake)}
          onClose={() => setAdjusting(false)}
          onSave={(b, w) => {
            setAdjusting(false);
            logNight(b, w);
          }}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  tiles: { flexDirection: 'row', gap: 10 },
  flex: { flex: 1 },
  tableRow: { flexDirection: 'row', paddingVertical: 8, borderTopWidth: 1, gap: 8 },
});
