import { Repeat } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { formatIndianNumber } from '@/lib/format';
import { Button, SegmentedToggle, Sheet, SheetCancel, StatusChip, Text, useTheme } from '@/ui';

import { signed } from '../lib/logging';
import { type DishRow, type GroupView, type MealView, num } from '../lib/plan';

const SCOPES = [
  { value: 'today', label: 'Today only' },
  { value: 'default', label: 'Make default' },
] as const;

const title = (d: DishRow) => (d.serving_text ? `${d.name} ${d.serving_text}` : d.name);

/** Food-SwapSheet design: alternatives in the group with deltas; today only or as the new default. */
export function SwapSheet({
  view,
  group,
  initialDishId,
  dayPlannedKcal,
  kcalTarget,
  onSwap,
  onClose,
}: {
  view: MealView;
  group: GroupView;
  initialDishId?: string;
  dayPlannedKcal: number;
  kcalTarget: number;
  onSwap: (to: DishRow, makeDefault: boolean) => void;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const options = group.alternatives;
  const [picked, setPicked] = useState(initialDishId ?? options[0]?.id ?? '');
  const [scope, setScope] = useState<'today' | 'default'>('today');
  const to = options.find((d) => d.id === picked) ?? null;
  const cur = group.dish;
  const bestProtein = options.reduce<DishRow | null>(
    (best, d) => (num(d.protein_g) > num(best?.protein_g ?? cur.protein_g) ? d : best),
    null,
  );
  const deltaKcal = to ? to.kcal - cur.kcal : 0;
  const deltaProtein = to ? num(to.protein_g) - num(cur.protein_g) : 0;
  const mealAfter = {
    kcal: view.planned.kcal + deltaKcal,
    protein: Math.round(view.planned.protein + deltaProtein),
  };
  const dayAfter = dayPlannedKcal + deltaKcal;
  const diff = dayAfter - kcalTarget;

  return (
    <Sheet
      visible
      onClose={onClose}
      title={`Swap ${group.group}`}
      subtitle={`${view.name} · now ${title(cur)} · ${cur.kcal} kcal · ${Math.round(num(cur.protein_g))} g`}
      testID="swap-sheet"
    >
      <View accessibilityRole="radiogroup" accessibilityLabel="Alternatives" style={styles.list}>
        {options.map((d) => {
          const selected = d.id === picked;
          const dk = d.kcal - cur.kcal;
          const dp = num(d.protein_g) - num(cur.protein_g);
          return (
            <Pressable
              key={d.id}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={`${title(d)}, ${signed(dk, ' kcal')}, ${signed(dp, ' g protein')}`}
              onPress={() => setPicked(d.id)}
              style={[
                styles.option,
                {
                  borderColor: selected ? colors.accents.primary.base : colors.hairline,
                  backgroundColor: colors.raised,
                },
              ]}
            >
              <View
                style={[
                  styles.radio,
                  { borderColor: selected ? colors.accents.primary.base : colors.border },
                ]}
              >
                {selected ? (
                  <View style={[styles.dot, { backgroundColor: colors.accents.primary.base }]} />
                ) : null}
              </View>
              <View style={styles.flex}>
                <View style={styles.nameRow}>
                  <Text variant="body" weight={700}>
                    {title(d)}
                  </Text>
                  {bestProtein?.id === d.id ? (
                    <StatusChip label="Most protein" tone="success" />
                  ) : null}
                </View>
                <Text variant="caption" tone="secondary" num>
                  {`${d.kcal} kcal · `}
                  <Text
                    variant="caption"
                    tone="protein"
                    num
                  >{`${Math.round(num(d.protein_g))} g`}</Text>
                </Text>
              </View>
              <View style={styles.right}>
                <Text variant="sub" weight={700} num>
                  {signed(dk, ' kcal')}
                </Text>
                <Text
                  variant="caption"
                  tone={dp > 0 ? 'success' : dp < 0 ? 'danger' : 'secondary'}
                  num
                >
                  {signed(dp, ' g protein')}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
      <SegmentedToggle
        accessibilityLabel="Applies to"
        options={SCOPES}
        value={scope}
        onChange={setScope}
      />
      <Text variant="sub" tone="secondary" num>
        {`${view.name} becomes ${formatIndianNumber(mealAfter.kcal)} kcal · ${mealAfter.protein} g. Day plan: ${formatIndianNumber(dayAfter)} kcal${
          diff > 0 ? ` (${diff} over)` : diff < 0 ? ` (${-diff} under)` : ''
        }.`}
        {scope === 'default' ? ` Every day from now on.` : ''}
      </Text>
      <Button
        icon={Repeat}
        label={to ? `Swap to ${title(to)}` : 'Swap'}
        accessibilityLabel={to ? `Swap to ${to.name}` : 'Swap'}
        disabled={!to}
        onPress={() => to && onSwap(to, scope === 'default')}
        fullWidth
        size="lg"
      />
      <SheetCancel onCancel={onClose} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  list: { gap: 10 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    minHeight: 44,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  flex: { flex: 1, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  right: { alignItems: 'flex-end' },
});
