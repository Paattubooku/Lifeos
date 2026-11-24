import { useRouter } from 'expo-router';
import { Footprints, HeartPulse, Plus, RefreshCw } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Bars } from '@/features/money/components/SpendBars';
import { useProfile } from '@/features/profile/hooks/useProfileData';
import { dayMinutes, hhmm } from '@/features/routine/lib/blocks';
import { applyChanges } from '@/features/routine/slice';
import { useNow } from '@/features/today/hooks/useNow';
import { shortDay } from '@/features/today/lib/present';
import { nowDayMinutes } from '@/features/today/lib/timeline';
import { istClock } from '@/lib/dates';
import { formatClock, formatIndianNumber } from '@/lib/format';
import { useAppDispatch } from '@/store';
import {
  Button,
  Card,
  NumberStepper,
  Ring,
  Screen,
  StatTile,
  Text,
  useSnackbar,
  useTheme,
} from '@/ui';

import { useLiveSteps, useSteps } from '../hooks/useSteps';
import { MAX_STEPS, QUICK_ADD, stepsHint, stepsTone } from '../lib/steps';

/** Event-time clock (kept out of render for the React Compiler). */
const clock = () => Date.now();
const n = (v: number) => formatIndianNumber(v);

/** `/steps` (PRD F21; no design, built on the Water pattern per DESIGN_NOTES). */
export function StepsScreen({ now: fixedNow }: { now?: number } = {}) {
  const ticking = useNow(60_000);
  const now = fixedNow ?? ticking;
  const router = useRouter();
  const dispatch = useAppDispatch();
  const showSnackbar = useSnackbar();
  const { colors, scheme } = useTheme();
  const { profile } = useProfile();
  const s = useSteps(now);
  const [exact, setExact] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const live = useLiveSteps(s.auto === 'phone', now);
  const shown = live !== null ? Math.max(live, s.count ?? 0) : s.count;
  const steps = shown ?? 0;
  // Refresh the stored days once per visit when counting automatically.
  const synced = useRef(false);
  const { auto, syncAuto } = s;
  useEffect(() => {
    if (!auto || synced.current) return;
    synced.current = true;
    void syncAuto(clock()).catch(() => false);
  }, [auto, syncAuto]);
  const t = s.targets;
  const sleepMin = dayMinutes(hhmm(profile?.sleep_time ?? '22:00'));
  const hint = stepsHint(steps, t, nowDayMinutes(now), sleepMin);
  const tone = stepsTone(steps, t.min);
  const connected = s.link === 'connected';

  const connect = async () => {
    setBusy(true);
    const r = await s.connect(clock());
    setBusy(false);
    showSnackbar({
      message:
        r === 'connected'
          ? 'Apple Health connected'
          : r === 'denied'
            ? 'Health access was not given. Enter steps by hand, or allow it in Settings → Health.'
            : 'Apple Health needs the TestFlight build. Use “Count steps automatically” instead.',
    });
  };
  const refresh = async () => {
    setBusy(true);
    await s.syncAuto(clock()).catch(() => false);
    setBusy(false);
  };
  const startCounting = async () => {
    setBusy(true);
    const r = await s.startCounting(clock());
    setBusy(false);
    showSnackbar({
      message:
        r === 'on'
          ? 'Counting steps automatically'
          : r === 'denied'
            ? 'Motion & Fitness is off. Turn it on in Settings → Privacy & Security → Motion & Fitness.'
            : 'This phone can’t count steps. Enter them by hand.',
    });
  };
  const setMin = (min: number) =>
    profile &&
    void dispatch(
      applyChanges([
        { op: 'upsert', table: 'profile', clientId: profile.client_id, row: { steps_min: min } },
      ]),
    );

  return (
    <Screen
      title="Steps"
      subtitle={`Minimum ${n(t.min)} · stretch ${n(t.stretch)}`}
      withTabBar={false}
      back={{ label: 'Back', onPress: () => router.back() }}
    >
      <Card testID="steps-card">
        <View style={styles.row}>
          <Ring
            progress={steps / t.stretch}
            marker={t.min / t.stretch}
            accent={tone === 'done' ? 'success' : 'primary'}
            size={120}
            strokeWidth={12}
            accessibilityLabel={`${n(steps)} steps today. Tick at the ${n(t.min)} minimum`}
          >
            <Text variant="heading" num>
              {shown === null ? '—' : n(steps)}
            </Text>
            <Text variant="caption" tone="secondary">
              steps
            </Text>
          </Ring>
          <View style={styles.flex}>
            <Text
              variant="body"
              weight={700}
              style={hint.urgent ? { color: colors.accents.danger.base } : null}
              testID="steps-hint"
            >
              {hint.text}
            </Text>
            <Text variant="caption" tone="secondary">
              {connected
                ? `From Apple Health${s.lastReadAt ? ` · ${formatClock(istClock(s.lastReadAt))}` : ''}`
                : s.auto === 'phone'
                  ? live !== null
                    ? 'Counting live on this iPhone'
                    : 'Counted by this iPhone'
                  : 'Entered by hand'}
            </Text>
          </View>
        </View>
      </Card>

      <View style={styles.tiles}>
        <StatTile
          label="7-day avg"
          accent="primary"
          value={s.week.avg7 === null ? '—' : n(s.week.avg7)}
          sub="steps"
          style={styles.flex}
        />
        <StatTile
          label={`Days ≥ ${n(t.min)}`}
          accent="success"
          value={`${s.week.hit7} / 7`}
          sub="last week"
          style={styles.flex}
        />
      </View>

      {connected ? (
        <Card padding={14} testID="health-connected">
          <View style={styles.row}>
            <HeartPulse size={20} color={colors.accents.danger.base} />
            <Text variant="body" weight={600} style={styles.flex}>
              Apple Health connected
            </Text>
            <Button
              size="sm"
              variant="secondary"
              icon={RefreshCw}
              label={busy ? '…' : 'Refresh'}
              accessibilityLabel="Refresh steps from Apple Health"
              disabled={busy}
              onPress={() => void refresh()}
            />
          </View>
          <Text variant="caption" tone="secondary">
            No steps showing? Allow LifeOS in the Health app → Sharing → Apps.
          </Text>
          <Button
            size="sm"
            variant="ghost"
            label="Disconnect"
            accessibilityLabel="Disconnect Apple Health"
            onPress={s.disconnect}
          />
        </Card>
      ) : s.auto === 'phone' ? (
        <Card padding={14} testID="motion-on">
          <View style={styles.row}>
            <Footprints size={20} color={colors.accents.success.base} />
            <Text variant="body" weight={600} style={styles.flex}>
              Counting automatically
            </Text>
            <Button
              size="sm"
              variant="secondary"
              icon={RefreshCw}
              label={busy ? '…' : 'Refresh'}
              accessibilityLabel="Refresh steps from this iPhone"
              disabled={busy}
              onPress={() => void refresh()}
            />
          </View>
          <Text variant="caption" tone="secondary">
            {`Your iPhone counts steps all day, even with LifeOS closed. It keeps 7 days, so open LifeOS at least once a week.${s.lastReadAt ? ` Updated ${formatClock(istClock(s.lastReadAt))}.` : ''}`}
          </Text>
          <Button
            size="sm"
            variant="ghost"
            label="Turn off"
            accessibilityLabel="Turn off automatic step counting"
            onPress={s.stopCounting}
          />
        </Card>
      ) : (
        <Card testID="manual">
          <Text variant="kicker" tone="secondary">
            Log steps
          </Text>
          <View style={styles.row}>
            {QUICK_ADD.map((a) => (
              <Button
                key={a}
                size="sm"
                variant="secondary"
                icon={Plus}
                label={n(a)}
                accessibilityLabel={`Add ${n(a)} steps`}
                onPress={() => void s.setToday(steps + a)}
                style={styles.flex}
              />
            ))}
          </View>
          {exact === null ? (
            <Button
              size="sm"
              variant="ghost"
              label="Set today’s total"
              accessibilityLabel="Set today’s total"
              onPress={() => setExact(steps)}
            />
          ) : (
            <View style={styles.gap}>
              <NumberStepper
                value={exact}
                onChange={setExact}
                accessibilityLabel="Today’s steps"
                step={(v) => (v >= 1000 ? 500 : 100)}
                min={0}
                max={MAX_STEPS}
                unit="steps"
              />
              <Button
                label="Save"
                accessibilityLabel="Save today’s steps"
                onPress={() => {
                  void s.setToday(exact);
                  setExact(null);
                }}
              />
            </View>
          )}
          <View style={[styles.connectCol, { borderColor: colors.hairline }]}>
            <Text variant="sub" tone="secondary">
              {s.motion === 'denied'
                ? 'Motion & Fitness is off for this app. Turn it on in Settings → Privacy & Security → Motion & Fitness, then try again.'
                : 'Let your iPhone count steps for you: free, no setup.'}
            </Text>
            <Button
              icon={Footprints}
              label={busy ? 'Starting…' : 'Count steps automatically'}
              accessibilityLabel="Count steps automatically"
              disabled={busy}
              fullWidth
              onPress={() => void startCounting()}
            />
            <Button
              icon={HeartPulse}
              size="sm"
              variant="ghost"
              label={
                s.link === 'denied' ? 'Connect Health (access was not given)' : 'Connect Health'
              }
              accessibilityLabel="Connect Health"
              disabled={busy}
              onPress={() => void connect()}
            />
          </View>
        </Card>
      )}

      <Card kicker="Last 14 days" testID="steps-bars">
        {s.days.some((d) => d.steps !== null) ? (
          <Bars
            bars={s.days.map((d) => ({
              label: String(Number(d.date.slice(8))),
              value: d.steps ?? 0,
              detail: shortDay(d.date),
            }))}
            color={scheme === 'dark' ? colors.accents.primary.light : colors.buttonPrimary}
            format={(v) => `${n(v)} steps`}
            target={{ value: t.min, label: n(t.min) }}
            everyOtherLabel
            emphasis={(i) => (s.days[i]?.steps ?? 0) >= t.min}
            accessibilityLabel={`Steps per day for 14 days, minimum ${n(t.min)}`}
          />
        ) : (
          <Text variant="sub" tone="secondary">
            No steps yet. Count automatically or add today’s steps.
          </Text>
        )}
      </Card>

      <Card kicker="Daily minimum">
        <NumberStepper
          value={t.min}
          onChange={setMin}
          accessibilityLabel="Daily steps minimum"
          step={500}
          min={1000}
          max={30000}
          unit="steps"
        />
        <Text
          variant="caption"
          tone="secondary"
        >{`Stretch target is the minimum + 4,000 (${n(t.stretch)}).`}</Text>
      </Card>
      <View style={styles.footer}>
        <Footprints size={14} color={colors.textSecondary} />
        <Text variant="caption" tone="secondary">
          A Steps block in your routine ticks itself at the minimum.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1 },
  gap: { gap: 10 },
  tiles: { flexDirection: 'row', gap: 10 },
  connectCol: { gap: 8, borderTopWidth: 1, paddingTop: 12 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
