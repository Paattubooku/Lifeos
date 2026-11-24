import { useRouter } from 'expo-router';
import {
  Droplet,
  Dumbbell,
  Flame,
  Footprints,
  MoonStar,
  NotebookPen,
  Scale,
  Soup,
} from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { NIGHTS, TARGET_HOURS } from '@/features/sleep/lib/sleep';
import { useNow } from '@/features/today/hooks/useNow';
import { shortDay } from '@/features/today/lib/present';
import { addDays } from '@/lib/dates';
import { formatIndianNumber } from '@/lib/format';
import { useReviews } from '@/features/review/hooks/useReview';
import { useSteps } from '@/features/steps/hooks/useSteps';
import type { Summary } from '@/features/review/lib/review';
import { Button, Screen, Text, useTheme } from '@/ui';

import { useProgress } from '../hooks/useProgress';
import { pctChange } from '../lib/progress';
import { MiniBars, MiniHeat, MiniLine } from './MiniCharts';
import { SectionCard } from './SectionCard';

const signed = (v: number, unit: string) =>
  `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v)}${unit}`;

/** Progress tab (PRD F16, Prog-Tab design): one card per area, each opens its detail. */
export function ProgressScreen({ now: fixedNow }: { now?: number } = {}) {
  const ticking = useNow(60_000);
  const now = fixedNow ?? ticking;
  const router = useRouter();
  const { colors, scheme } = useTheme();
  const p = useProgress(now);
  const series = (dark: string, light: string) => (scheme === 'dark' ? dark : light);
  const a = colors.accents;

  // Weight: 7-day averages of the last 28 days.
  const w = p.weight.stats;
  const recent = p.weight.points.filter((x) => x.date >= addDays(p.today, -27));
  const total = w.totalLost;

  // Food: protein and kcal of the last 14 days.
  const f = p.food;
  const deficit = f.kcalAvg === null ? null : Math.round(f.tdee - f.kcalAvg);

  // Training: sessions per week, last 8 weeks.
  const weeks = p.train.weeks;
  const prev = weeks.at(-2)?.done ?? 0;
  const trained = weeks.some((x) => x.done > 0);

  // Sleep: last 7 nights' average vs the previous 7.
  const s = p.sleep.stats;
  const nights = p.sleep.nights;
  const prev7 = nights
    .slice(0, 7)
    .map((n) => n.hours)
    .filter((h): h is number => h !== null);
  const prevAvg = prev7.length ? prev7.reduce((x, y) => x + y, 0) / prev7.length : null;
  const sleepDelta =
    s.avg7 !== null && prevAvg !== null ? Math.round((s.avg7 - prevAvg) * 10) / 10 : null;

  const wa = p.water;
  const reviews = useReviews();
  const st = useSteps(now);
  const lastReview = reviews[0];
  const lastSummary = (lastReview?.summary ?? null) as Partial<Summary> | null;

  return (
    <Screen
      title="Progress"
      kicker={shortDay(p.today)}
      action={
        <Button
          icon={NotebookPen}
          size="sm"
          label="Weekly review"
          accessibilityLabel="Weekly review"
          onPress={() => router.push('/review')}
        />
      }
    >
      <SectionCard
        icon={Scale}
        accent="primary"
        kicker="Weight"
        value={w.avg7 === null ? '—' : `${w.avg7.toFixed(1)} kg`}
        sub={w.avg7 === null ? 'No weigh-ins yet' : '7-day avg'}
        delta={
          total === null || total === 0
            ? null
            : { text: `${signed(-total, '')} total`, tone: total > 0 ? 'good' : 'bad' }
        }
        summary={
          recent.length > 1
            ? `7-day average over 4 weeks, ${recent[0]!.avg7} to ${recent.at(-1)!.avg7} kg, goal ${p.weight.goal} kg`
            : 'No trend yet'
        }
        chart={
          recent.length > 1 ? (
            <MiniLine
              values={recent.map((x) => x.avg7)}
              color={series(a.primary.light, colors.buttonPrimary)}
            />
          ) : null
        }
        onPress={() => router.push('/weight')}
        testID="progress-weight"
      />

      <SectionCard
        icon={Flame}
        accent="success"
        kicker="Streaks"
        value={`${p.streak.current} ${p.streak.current === 1 ? 'day' : 'days'}`}
        sub={`best ${p.streak.best} · grace ${p.streak.graceUsed} used`}
        summary={`30 days of scores: ${p.streak.cells.filter((c) => c.score !== null).length} scored`}
        chart={<MiniHeat cells={p.streak.cells} />}
        onPress={() => router.push('/streaks')}
        testID="progress-streaks"
      />

      <SectionCard
        icon={Soup}
        accent="calories"
        kicker="Food"
        value={f.kcalAvg === null ? '—' : formatIndianNumber(f.kcalAvg)}
        sub={
          f.kcalAvg === null
            ? 'Nothing logged in the last week'
            : `kcal · 7-day avg · protein ${f.proteinAvg ?? 0} g`
        }
        delta={
          deficit === null
            ? null
            : deficit >= 0
              ? { text: `deficit ${formatIndianNumber(deficit)}`, tone: 'good' }
              : { text: `surplus ${formatIndianNumber(-deficit)}`, tone: 'bad' }
        }
        summary={`${FOOD_SUMMARY(f.kcal.filter((d) => d.value !== null).length)}; targets ${formatIndianNumber(f.kcalTarget)} kcal and ${f.proteinTarget} g protein`}
        chart={
          f.kcal.some((d) => d.value !== null) ? (
            <View style={styles.pair}>
              <Text variant="caption" tone="secondary">
                kcal
              </Text>
              <MiniBars
                values={f.kcal.map((d) => d.value)}
                target={f.kcalTarget}
                color={series(a.calories.base, a.calories.base)}
                height={30}
                testID="food-kcal-bars"
              />
              <Text variant="caption" tone="secondary">
                protein
              </Text>
              <MiniBars
                values={f.protein.map((d) => d.value)}
                target={f.proteinTarget}
                dimBelow={f.proteinTarget}
                color={a.protein.base}
                height={30}
                testID="food-protein-bars"
              />
            </View>
          ) : null
        }
        onPress={() => router.push('/food')}
        testID="progress-food"
      />

      <SectionCard
        icon={Dumbbell}
        accent="protein"
        kicker="Training"
        value={`${p.train.done} / ${p.train.planned}`}
        sub="sessions this week"
        delta={
          prev > 0 && weeks.at(-1)
            ? {
                text: `${signed(pctChange(weeks.at(-1)!.done, prev) ?? 0, '%')} vs last week`,
                tone: 'neutral',
              }
            : null
        }
        summary={`Sessions per week, last 8 weeks: ${weeks.map((x) => x.done).join(', ')}`}
        chart={
          trained ? (
            <MiniBars
              values={weeks.map((x) => x.done)}
              target={p.train.planned || undefined}
              color={a.protein.base}
              testID="train-bars"
            />
          ) : null
        }
        onPress={() => router.push('/train')}
        testID="progress-train"
      />

      <SectionCard
        icon={MoonStar}
        accent="primary"
        kicker="Sleep"
        value={s.avg7 === null ? '—' : `${s.avg7} h`}
        sub={s.avg7 === null ? 'No nights logged yet' : `7-day avg · target ${TARGET_HOURS} h`}
        delta={
          sleepDelta === null || sleepDelta === 0
            ? null
            : { text: signed(sleepDelta, ' h'), tone: sleepDelta > 0 ? 'good' : 'bad' }
        }
        summary={`${s.atTarget} of ${NIGHTS} nights at ${TARGET_HOURS} h or more`}
        chart={
          s.logged > 0 ? (
            <MiniBars
              values={nights.map((n) => n.hours)}
              target={TARGET_HOURS}
              dimBelow={TARGET_HOURS}
              color={series(a.primary.light, colors.buttonPrimary)}
              testID="sleep-mini-bars"
            />
          ) : null
        }
        onPress={() => router.push('/sleep')}
        testID="progress-sleep"
      />

      <SectionCard
        icon={Droplet}
        accent="water"
        kicker="Water"
        value={wa.avg7 === null ? '—' : formatIndianNumber(wa.avg7)}
        sub={
          wa.avg7 === null
            ? 'No water logged last week'
            : `ml · 7-day avg · goal ${formatIndianNumber(wa.goal)}`
        }
        delta={wa.avg7 === null ? null : { text: `${wa.hit7} of 7 hit`, tone: 'neutral' }}
        summary={`Water per day, last 14 days, goal ${formatIndianNumber(wa.goal)} ml`}
        chart={
          wa.days.some((d) => d.value !== null) ? (
            <MiniBars
              values={wa.days.map((d) => d.value)}
              target={wa.goal}
              dimBelow={wa.goal}
              color={a.water.base}
              testID="water-mini-bars"
            />
          ) : null
        }
        onPress={() => router.push('/water')}
        testID="progress-water"
      />

      <SectionCard
        icon={Footprints}
        accent="success"
        kicker="Steps"
        value={st.week.avg7 === null ? '—' : formatIndianNumber(st.week.avg7)}
        sub={
          st.week.avg7 === null
            ? st.auto
              ? 'No steps counted yet'
              : 'Turn on step counting'
            : `7-day avg · minimum ${formatIndianNumber(st.targets.min)}`
        }
        delta={st.week.avg7 === null ? null : { text: `${st.week.hit7} of 7 hit`, tone: 'neutral' }}
        summary={`Steps per day, last 14 days, minimum ${formatIndianNumber(st.targets.min)}`}
        chart={
          st.days.some((d) => d.steps !== null) ? (
            <MiniBars
              values={st.days.map((d) => d.steps)}
              target={st.targets.min}
              dimBelow={st.targets.min}
              color={a.success.base}
              testID="steps-mini-bars"
            />
          ) : null
        }
        onPress={() => router.push('/steps')}
        testID="progress-steps"
      />

      <SectionCard
        icon={NotebookPen}
        accent="primary"
        kicker="Reviews"
        value={lastReview?.grade ?? '—'}
        sub={
          lastReview
            ? `last week ${typeof lastSummary?.avgScore === 'number' ? `${lastSummary.avgScore}%` : ''} · ${reviews.length} ${reviews.length === 1 ? 'review' : 'reviews'}`
            : 'Sundays at 8:00 pm, two minutes'
        }
        summary={
          lastReview?.change_next_week ? `Change: ${lastReview.change_next_week}` : 'No reviews yet'
        }
        onPress={() => router.push('/reviews')}
        testID="progress-reviews"
      />
    </Screen>
  );
}

const FOOD_SUMMARY = (n: number) => `${n} of 14 days logged`;

const styles = StyleSheet.create({
  pair: { alignItems: 'flex-end' },
});
