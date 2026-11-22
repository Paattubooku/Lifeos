import { Redirect, useRouter } from 'expo-router';
import { Check, ChevronDown, Droplet, Inbox, Plus, Scale } from 'lucide-react-native';
import { type ReactNode, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { formatClock, formatIndianNumber, formatInr } from '@/lib/format';
import { useAppDispatch, useAppSelector } from '@/store';
import { setThemePreference } from '@/store/appSlice';
import {
  Banner,
  Button,
  Card,
  Chip,
  EmptyState,
  Fab,
  ListRow,
  NumberStepper,
  ProgressBar,
  Ring,
  Screen,
  SegmentedToggle,
  Sheet,
  StatTile,
  StatusChip,
  Text,
  TimePicker,
  TripleRing,
  useSnackbar,
} from '@/ui';

/** Dev-only: every src/ui primitive with mock numbers, in the order of the component sheets. */
export default function Gallery() {
  if (!__DEV__) return <Redirect href="/today" />;
  return <GalleryContent />;
}

function GalleryContent() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const theme = useAppSelector((s) => s.app.themePreference);
  const showSnackbar = useSnackbar();

  const [reason, setReason] = useState('sick');
  const [template, setTemplate] = useState<'workday' | 'weekend' | 'rest'>('workday');
  const [water, setWater] = useState(350);
  const [weight, setWeight] = useState(91.0);
  const [wake, setWake] = useState('05:00');
  const [rows, setRows] = useState({ bill: false, pr: true, dentist: false });
  const [sheet, setSheet] = useState(false);
  const noop = () => undefined;

  return (
    <Screen
      title="Components"
      subtitle="Mock data. Compare with design/screens/Components-*.png."
      withTabBar={false}
      accessory={
        <Button
          size="sm"
          variant="outline"
          label="Close"
          accessibilityLabel="Close gallery"
          onPress={() => router.back()}
        />
      }
    >
      <SegmentedToggle
        accessibilityLabel="Theme"
        options={[
          { value: 'system', label: 'System' },
          { value: 'light', label: 'Light' },
          { value: 'dark', label: 'Dark' },
        ]}
        value={theme}
        onChange={(v) => dispatch(setThemePreference(v))}
      />

      <Section title="Buttons">
        <Wrap>
          <Button label="Start Upper A" accessibilityLabel="Start Upper A" onPress={noop} />
          <Button variant="secondary" label="Edit" accessibilityLabel="Edit" onPress={noop} />
          <Button variant="ghost" label="All tasks" accessibilityLabel="All tasks" onPress={noop} />
          <Button
            variant="destructive"
            label="Delete entry"
            accessibilityLabel="Delete entry"
            onPress={noop}
          />
        </Wrap>
        <Wrap>
          <Button
            disabled
            label="Start Upper A"
            accessibilityLabel="Start Upper A, disabled"
            onPress={noop}
          />
          <Button
            disabled
            variant="ghost"
            label="All tasks"
            accessibilityLabel="All tasks, disabled"
            onPress={noop}
          />
        </Wrap>
        <Wrap>
          <Button
            variant="water"
            icon={Droplet}
            label="Log 500 ml"
            accessibilityLabel="Log 500 ml"
            onPress={noop}
          />
          <Button
            size="lg"
            icon={Scale}
            label="Log weight"
            accessibilityLabel="Log weight"
            onPress={noop}
          />
          <Button
            size="sm"
            variant="outline"
            label="+100 ml"
            accessibilityLabel="Add 100 ml"
            onPress={noop}
          />
        </Wrap>
      </Section>

      <Section title="Chips">
        <Wrap>
          <Chip
            label="Workday"
            trailingIcon={ChevronDown}
            accessibilityLabel="Template Workday, change"
            onPress={noop}
          />
          {(['sick', 'travel', 'rest'] as const).map((r) => (
            <Chip
              key={r}
              label={r[0]!.toUpperCase() + r.slice(1)}
              selected={reason === r}
              leadingIcon={reason === r ? Check : undefined}
              accessibilityLabel={`Reason ${r}`}
              onPress={() => setReason(r)}
            />
          ))}
        </Wrap>
        <Wrap>
          <StatusChip label="NOW" tone="primary" beacon />
          <StatusChip label="auto: 500 ml" tone="water" />
          <StatusChip label="Overdue 30 min" tone="danger" />
          <StatusChip label="640 kcal" tone="calories" />
          <StatusChip label="Skipped" />
          <StatusChip label="42 g protein" tone="protein" />
          <StatusChip label="Done" tone="success" />
        </Wrap>
      </Section>

      <Section title="Segmented toggle">
        <SegmentedToggle
          accessibilityLabel="Template"
          options={[
            { value: 'workday', label: 'Workday' },
            { value: 'weekend', label: 'Weekend' },
            { value: 'rest', label: 'Rest day' },
          ]}
          value={template}
          onChange={setTemplate}
        />
      </Section>

      <Section title="Banners">
        <Banner title="Template switched to Weekend" body="Applies to today only." />
        <Banner
          tone="danger"
          title="350 ml behind. Drink 350 ml now."
          body="Pace for 2:20 pm is 1,750 ml."
          action={{ label: 'Drink 350', accessibilityLabel: 'Drink 350 ml', onPress: noop }}
        />
        <Banner
          tone="danger"
          title="9:30 pm. Phone away."
          body="Lights out in 30 min. 3 items open."
        />
      </Section>

      <Section title="Cards & stat tiles">
        <Card kicker="Next · 5:30 am" title="Workout · Upper A">
          <Text variant="sub" tone="secondary">
            DB bench 4×8 · 1-arm row 4×10 · +4 more · 55 min
          </Text>
          <Button label="Start Upper A" accessibilityLabel="Start Upper A" onPress={noop} />
        </Card>
        <View style={styles.row}>
          <StatTile label="Calories" value="640" sub={`of ${formatIndianNumber(2200)} kcal`} />
          <StatTile label="Protein" value="32 g" sub="of 150 g" accent="protein" />
          <StatTile label="Coffee" value="1" sub="of 2 max" />
        </View>
        <View style={styles.row}>
          <StatTile label="Weight" value="91.0" sub="7-day avg 91.3" />
          <StatTile
            label="Water"
            value={formatIndianNumber(2929)}
            sub="7-day avg ml"
            accent="water"
          />
          <StatTile label="Streak" value="12 days" sub="grace 1 left" />
        </View>
      </Section>

      <Section title="List row · checkbox + swipe">
        <ListRow
          title={`Pay electricity bill ${formatInr(2340)}`}
          meta="Due today"
          done={rows.bill}
          onToggle={(v) => setRows((s) => ({ ...s, bill: v }))}
          onTomorrow={noop}
          onDelete={() =>
            showSnackbar({ message: 'Deleted task', actionLabel: 'Undo', onAction: noop })
          }
        />
        <ListRow
          title="Fix review comments on checkout PR"
          meta={formatClock('11:40')}
          done={rows.pr}
          onToggle={(v) => setRows((s) => ({ ...s, pr: v }))}
        />
        <ListRow
          title="Book dentist for Saturday"
          meta="Before 6 pm"
          done={rows.dentist}
          onToggle={(v) => setRows((s) => ({ ...s, dentist: v }))}
          onTomorrow={noop}
          onDelete={noop}
        />
      </Section>

      <Section title="Stepper & time picker">
        <Text variant="kicker" tone="secondary">
          Water · 50 ml steps
        </Text>
        <NumberStepper
          accessibilityLabel="Water amount"
          value={water}
          onChange={setWater}
          step={50}
          min={50}
          max={2000}
          unit="ml"
        />
        <Text variant="kicker" tone="secondary">
          Weight · 0.1 kg
        </Text>
        <NumberStepper
          accessibilityLabel="Weight"
          value={weight}
          onChange={setWeight}
          step={0.1}
          min={30}
          max={250}
          decimals={1}
          unit="kg"
        />
        <Text variant="kicker" tone="secondary">
          Wake time · {formatClock(wake)}
        </Text>
        <TimePicker accessibilityLabel="Wake time" value={wake} onChange={setWake} />
      </Section>

      <Section title="Undo snackbar">
        <Button
          variant="secondary"
          label="Show snackbar"
          accessibilityLabel="Show undo snackbar"
          onPress={() =>
            showSnackbar({
              message: `Deleted 300 ml · ${formatClock('12:10')}`,
              actionLabel: 'Undo',
              onAction: noop,
            })
          }
        />
      </Section>

      <Section title="Empty state">
        <Card>
          <EmptyState
            icon={Inbox}
            title="No tasks for today"
            body="Top 3 shows here. Add one in 2 taps."
            action={{
              label: 'Add task',
              icon: Plus,
              accessibilityLabel: 'Add task',
              onPress: noop,
            }}
          />
        </Card>
      </Section>

      <Section title="Bottom sheet">
        <Button
          variant="secondary"
          label="Open sheet"
          accessibilityLabel="Open sample sheet"
          onPress={() => setSheet(true)}
        />
        <Sheet
          visible={sheet}
          onClose={() => setSheet(false)}
          title="Sheet title"
          subtitle="One line of context with the number that matters."
        >
          <Wrap>
            <Chip label="Option A" selected accessibilityLabel="Option A" onPress={noop} />
            <Chip label="Option B" accessibilityLabel="Option B" onPress={noop} />
          </Wrap>
          <Button
            label="Confirm"
            accessibilityLabel="Confirm"
            fullWidth
            onPress={() => setSheet(false)}
          />
          <Button
            variant="ghost"
            label="Cancel"
            accessibilityLabel="Cancel"
            fullWidth
            onPress={() => setSheet(false)}
          />
        </Sheet>
      </Section>

      <Section title="Metric rings">
        <View style={[styles.row, styles.end]}>
          <Labeled label="Routine">
            <Ring progress={0.45} accent="primary" accessibilityLabel="Routine 45 percent">
              <Text variant="body" weight={700} num>
                45%
              </Text>
            </Ring>
          </Labeled>
          <Labeled label="Water · ml">
            <Ring
              progress={1400 / 3000}
              accent="water"
              size={100}
              strokeWidth={10}
              accessibilityLabel="Water 1,400 of 3,000 ml"
            >
              <Text variant="heading" num>
                {formatIndianNumber(1400)}
              </Text>
            </Ring>
          </Labeled>
          <Labeled label="Calories">
            <Ring progress={0.9} accent="calories" accessibilityLabel="Calories 90 percent">
              <Text variant="body" weight={700} num>
                90%
              </Text>
            </Ring>
          </Labeled>
        </View>
        <View style={styles.center}>
          <TripleRing
            rings={[
              { progress: 0.64, accent: 'primary' },
              { progress: 0.88, accent: 'water' },
              { progress: 0.82, accent: 'protein' },
            ]}
            accessibilityLabel="Day score 78 percent"
          >
            <Text variant="metric" num>
              78%
            </Text>
          </TripleRing>
        </View>
      </Section>

      <Section title="Progress bar with pace marker">
        <ProgressBar
          label="Water"
          valueText={`${formatIndianNumber(1400)} / ${formatIndianNumber(3000)} ml`}
          progress={1400 / 3000}
          pace={0.5}
          accent="water"
          caption="100 ml behind. Drink 100 ml now."
          captionTone="danger"
          accessibilityLabel="Water 1,400 of 3,000 ml, 100 ml behind pace"
        />
        <ProgressBar
          label="Protein"
          valueText="78 / 150 g"
          progress={78 / 150}
          pace={0.467}
          accent="protein"
          caption="8 g ahead of plan."
          captionTone="success"
          accessibilityLabel="Protein 78 of 150 g"
        />
        <ProgressBar
          label="Calories"
          valueText={`${formatIndianNumber(1980)} / ${formatIndianNumber(2200)} kcal`}
          progress={1980 / 2200}
          pace={1}
          accent="calories"
          caption="220 kcal under. Fine, do not add a snack after 9 pm."
          accessibilityLabel="Calories 1,980 of 2,200 kcal"
        />
      </Section>

      <Section title="Water FAB">
        <View style={styles.center}>
          <Fab
            onPress={() =>
              showSnackbar({
                message: `+200 ml · ${formatIndianNumber(1600)} / ${formatIndianNumber(3000)}`,
              })
            }
            onLongPress={() => setSheet(true)}
          />
        </View>
      </Section>
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text variant="heading" accessibilityRole="header">
        {title}
      </Text>
      {children}
    </View>
  );
}

function Wrap({ children }: { children: ReactNode }) {
  return <View style={styles.wrap}>{children}</View>;
}

function Labeled({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.labeled}>
      {children}
      <Text variant="kicker" tone="secondary">
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 12, marginTop: 8 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  row: { flexDirection: 'row', gap: 8 },
  end: { alignItems: 'flex-end', justifyContent: 'space-between' },
  center: { alignItems: 'center', paddingVertical: 8 },
  labeled: { alignItems: 'center', gap: 8 },
});
