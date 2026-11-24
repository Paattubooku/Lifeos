import { useRouter } from 'expo-router';
import { Check, Pencil } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { useNow } from '@/features/today/hooks/useNow';
import { formatInr } from '@/lib/format';
import { Button, Card, NumberStepper, Screen, Text, useTheme } from '@/ui';

import { useMoney } from '../hooks/useMoney';
import { useMoneyActions } from '../hooks/useMoneyActions';
import {
  AMBER_PCT,
  type BudgetTone,
  categoryBudgets,
  monthView,
  RED_PCT,
  unallocated,
} from '../lib/budget';
import { CATEGORY_ICONS, CategoryTile, categoryColor } from './look';
import { monthName } from './MoneyScreen';

/** ₹100 steps under ₹2,000, ₹500 above. */
const budgetStep = (v: number, d: 1 | -1) => (v + (d > 0 ? 0 : -1) >= 2000 ? 500 : 100);

function Meter({ pct, pace, color }: { pct: number; pace: number; color: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.track, { backgroundColor: colors.recessed }]}>
      <View
        style={[
          styles.fill,
          { width: `${Math.min(Math.max(pct, 0), 100)}%`, backgroundColor: color },
        ]}
      />
      <View
        style={[
          styles.tick,
          { left: `${Math.min(pace * 100, 100)}%`, backgroundColor: colors.text },
        ]}
      />
    </View>
  );
}

/** Money-Budgets design: overall budget, per-category bars (amber ≥ 80 %, red ≥ 100 %), Edit. */
export function BudgetsScreen({ now: fixedNow }: { now?: number } = {}) {
  const ticking = useNow(60_000);
  const now = fixedNow ?? ticking;
  const router = useRouter();
  const { colors } = useTheme();
  const m = useMoney(now);
  const actions = useMoneyActions();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, { icon: string; budget: number }>>({});
  const [overall, setOverall] = useState<number | null>(null);

  const v = monthView(m.expenses, m.today, m.budget);
  const cats = categoryBudgets(m.expenses, m.categories, m.today, m.otherId);
  const free = unallocated(m.budget, cats);
  const tone = (t: BudgetTone, fallback: string) =>
    t === 'red'
      ? colors.accents.danger.base
      : t === 'amber'
        ? colors.accents.calories.base
        : fallback;

  const startEdit = () => {
    setDraft(
      Object.fromEntries(
        cats.map((c) => [c.category.id, { icon: c.category.icon, budget: c.budget }]),
      ),
    );
    setOverall(m.budget);
    setEditing(true);
  };
  const save = () => {
    actions.saveBudgets(
      cats
        .filter((c) => {
          const d = draft[c.category.id];
          return d && (d.icon !== c.category.icon || d.budget !== c.budget);
        })
        .map((c) => ({
          clientId: c.category.client_id,
          icon: draft[c.category.id]!.icon,
          budget: draft[c.category.id]!.budget,
        })),
      m.profile && overall !== null && overall !== m.budget
        ? { clientId: m.profile.client_id, budget: overall }
        : null,
    );
    setEditing(false);
  };

  return (
    <Screen
      title="Budgets"
      subtitle={`${monthName(m.today)} · day ${v.day} of ${v.days}`}
      withTabBar={false}
      back={{ label: 'Money', onPress: () => router.back() }}
      action={
        editing ? (
          <Button
            icon={Check}
            size="sm"
            label="Save"
            accessibilityLabel="Save budgets"
            onPress={save}
          />
        ) : (
          <Button
            icon={Pencil}
            size="sm"
            variant="secondary"
            label="Edit"
            accessibilityLabel="Edit budgets"
            onPress={startEdit}
          />
        )
      }
    >
      <Card testID="total-card">
        <View style={styles.head}>
          <Text variant="kicker" tone="secondary" style={styles.flex}>
            Total
          </Text>
          <Text variant="body" weight={700} num>
            {`${formatInr(v.spent)} / ${formatInr(editing && overall !== null ? overall : m.budget)}`}
          </Text>
        </View>
        {editing && overall !== null ? (
          <NumberStepper
            value={overall}
            onChange={setOverall}
            accessibilityLabel="Monthly budget"
            step={budgetStep}
            min={0}
            max={10_00_000}
            unit="₹ a month"
          />
        ) : (
          <Meter
            pct={m.budget > 0 ? (v.spent / m.budget) * 100 : 0}
            pace={v.pace}
            color={tone(v.spent > m.budget ? 'red' : 'ok', colors.accents.primary.base)}
          />
        )}
        <Text variant="caption" tone="secondary">
          {`Categories cover ${formatInr(m.budget - free)}. ${free >= 0 ? `${formatInr(free)} unallocated` : `${formatInr(-free)} more than the total`} (rent and the like sit outside them).`}
        </Text>
      </Card>

      <Card padding={16} gap={4} testID="categories-card">
        <View style={styles.head}>
          <Text variant="caption" tone="secondary" style={styles.flex}>
            {`Tick = even pace for day ${v.day}`}
          </Text>
          <Text variant="caption" weight={700} style={{ color: colors.accents.calories.base }}>
            {`Amber ≥ ${AMBER_PCT}%`}
          </Text>
          <Text variant="caption" weight={700} style={{ color: colors.accents.danger.base }}>
            {`Red ≥ ${RED_PCT}%`}
          </Text>
        </View>
        {cats.map((c, i) => {
          const color = categoryColor(c.category, m.categories, colors);
          const d = draft[c.category.id];
          return (
            <View
              key={c.category.id}
              style={[
                styles.cat,
                i > 0 ? { borderTopWidth: 1, borderColor: colors.hairline } : null,
              ]}
              testID={`budget-${c.category.name}`}
            >
              <View style={styles.head}>
                <CategoryTile icon={editing && d ? d.icon : c.category.icon} color={color} />
                <Text variant="body" weight={600} style={styles.flex}>
                  {c.category.name}
                </Text>
                <Text variant="body" weight={700} num>
                  {formatInr(c.spent)}
                  <Text
                    variant="sub"
                    tone="secondary"
                  >{` / ${formatInr(editing && d ? d.budget : c.budget)}`}</Text>
                </Text>
              </View>
              {editing && d ? (
                <>
                  <NumberStepper
                    value={d.budget}
                    onChange={(b) =>
                      setDraft((x) => ({ ...x, [c.category.id]: { ...d, budget: b } }))
                    }
                    accessibilityLabel={`${c.category.name} budget`}
                    step={budgetStep}
                    min={0}
                    max={10_00_000}
                    unit="₹"
                  />
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.icons}>
                      {Object.keys(CATEGORY_ICONS).map((key) => (
                        <Pressable
                          key={key}
                          onPress={() =>
                            setDraft((x) => ({ ...x, [c.category.id]: { ...d, icon: key } }))
                          }
                          accessibilityRole="radio"
                          accessibilityState={{ selected: d.icon === key }}
                          accessibilityLabel={`${c.category.name} icon ${key.replace(/-/g, ' ')}`}
                          style={[
                            styles.iconPick,
                            {
                              borderColor:
                                d.icon === key ? colors.accents.primary.base : 'transparent',
                            },
                          ]}
                        >
                          <CategoryTile icon={key} color={color} size={32} />
                        </Pressable>
                      ))}
                    </View>
                  </ScrollView>
                </>
              ) : (
                <>
                  <Meter pct={c.pct} pace={v.pace} color={tone(c.tone, color)} />
                  <Text
                    variant="caption"
                    weight={c.tone === 'ok' ? 400 : 700}
                    tone={c.tone === 'ok' ? 'secondary' : undefined}
                    style={c.tone === 'ok' ? null : { color: tone(c.tone, color) }}
                  >
                    {c.left < 0
                      ? `Over by ${formatInr(-c.left)}`
                      : `${formatInr(c.left)} left · ${c.pct}%`}
                  </Text>
                </>
              )}
            </View>
          );
        })}
      </Card>
      {editing ? (
        <Button
          variant="secondary"
          label="Cancel"
          accessibilityLabel="Cancel editing"
          onPress={() => setEditing(false)}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  flex: { flex: 1 },
  track: { height: 8, borderRadius: 4, overflow: 'visible', justifyContent: 'center' },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 4 },
  tick: { position: 'absolute', width: 2, height: 16, marginLeft: -1, borderRadius: 1 },
  cat: { paddingVertical: 12, gap: 8 },
  icons: { flexDirection: 'row', gap: 6 },
  iconPick: { borderWidth: 2, borderRadius: 12, padding: 1 },
});
