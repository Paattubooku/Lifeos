import { useRouter } from 'expo-router';
import { Pencil, Repeat } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { hhmm } from '@/features/routine/lib/blocks';
import { useNow } from '@/features/today/hooks/useNow';
import { istClock } from '@/lib/dates';
import { formatClock } from '@/lib/format';
import {
  Button,
  Card,
  Checkbox,
  EmptyState,
  PressableScale,
  Screen,
  SegmentedToggle,
  StatTile,
  Text,
  useTheme,
} from '@/ui';

import { useFood } from '../hooks/useFood';
import { useFoodActions } from '../hooks/useFoodActions';
import { signed } from '../lib/logging';
import { type GroupView, num, type Portion, PORTIONS } from '../lib/plan';
import { SwapSheet } from './SwapSheet';

const PORTION_OPTIONS = PORTIONS.map((p) => ({ value: String(p.value), label: p.label }));

/** `/meal/[slot]` (Food-MealDetail design): each swap group, its alternatives, ticks and portions. */
export function MealDetailScreen({ slot, now: fixedNow }: { slot: string; now?: number }) {
  const ticking = useNow();
  const now = fixedNow ?? ticking;
  const router = useRouter();
  const { colors } = useTheme();
  const food = useFood(now);
  const actions = useFoodActions(food);
  const [swapping, setSwapping] = useState<{ group: GroupView; dishId?: string } | null>(null);
  const view = food.day.meals.find((m) => m.meal.slot === slot);
  const back = { label: 'Food', onPress: () => router.back() };

  if (!view) {
    return (
      <Screen title="Meal" withTabBar={false} back={back}>
        <EmptyState
          icon={Pencil}
          title="No such meal in the plan"
          body="Add it in the meal plan."
        />
      </Screen>
    );
  }

  const ticked = view.groups.filter((g) => g.log && num(g.log.portion) > 0).length;
  const sub = [
    formatClock(hhmm(view.meal.time)),
    view.tickedAt ? `ticked ${formatClock(istClock(view.tickedAt))}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Screen
      title={view.name}
      subtitle={sub}
      withTabBar={false}
      back={back}
      action={
        <PressableScale
          accessibilityLabel="Edit meal plan"
          onPress={() => router.push('/meal-plan')}
          style={[styles.edit, { backgroundColor: colors.raised, borderColor: colors.hairline }]}
        >
          <Pencil size={18} color={colors.text} strokeWidth={2} />
        </PressableScale>
      }
    >
      <View style={styles.tiles}>
        <StatTile
          label="Calories"
          accent="calories"
          value={String(view.eaten.kcal)}
          sub={`of plan ${view.planned.kcal}`}
          style={styles.flex}
        />
        <StatTile
          label="Protein"
          accent="protein"
          value={`${view.eaten.protein} g`}
          sub={`of plan ${view.planned.protein} g`}
          style={styles.flex}
        />
        <StatTile
          label="Eaten"
          accent="success"
          value={`${ticked} / ${view.groups.length}`}
          sub="dishes ticked"
          style={styles.flex}
        />
      </View>

      {view.groups.map((g) => {
        const portion = g.log ? num(g.log.portion) : 1;
        return (
          <Card key={g.group} kicker={g.group} testID={`group-${g.group}`}>
            <Text variant="caption" tone="secondary" style={styles.swaps}>
              {g.alternatives.length === 0
                ? 'No swaps'
                : `${g.alternatives.length} swap${g.alternatives.length === 1 ? '' : 's'}`}
            </Text>
            <View
              style={[
                styles.chosen,
                {
                  borderColor: colors.accents.primary.base,
                  backgroundColor: colors.accents.primary.tint,
                },
              ]}
            >
              <Checkbox
                checked={Boolean(g.log) && portion > 0}
                onToggle={() => void actions.toggleDish(view, g)}
                accessibilityLabel={`${g.log ? 'Untick' : 'Tick'} ${g.dish.name}`}
              />
              <View style={styles.flex}>
                <Text variant="body" weight={700}>
                  {g.dish.name}
                </Text>
                <Text variant="caption" tone="secondary">
                  {g.dish.serving_text}
                </Text>
              </View>
              <View style={styles.right}>
                <Text
                  variant="sub"
                  weight={700}
                  num
                >{`${g.log ? g.log.kcal : g.dish.kcal} kcal`}</Text>
                <Text variant="caption" tone="protein" weight={700} num>
                  {`${Math.round(g.log ? num(g.log.protein_g) : num(g.dish.protein_g))} g`}
                </Text>
              </View>
            </View>
            {g.alternatives.map((alt) => (
              <Pressable
                key={alt.id}
                onPress={() => setSwapping({ group: g, dishId: alt.id })}
                accessibilityRole="button"
                accessibilityLabel={`Swap to ${alt.name}, ${signed(alt.kcal - g.dish.kcal, ' kcal')}`}
                style={[styles.alt, { borderTopColor: colors.hairline }]}
              >
                <Repeat size={16} color={colors.textSecondary} strokeWidth={2} />
                <Text variant="sub" style={styles.flex}>
                  {alt.serving_text ? `${alt.name} · ${alt.serving_text}` : alt.name}
                </Text>
                <Text variant="caption" weight={700} num>
                  {signed(alt.kcal - g.dish.kcal, ' kcal')}
                </Text>
                <Text
                  variant="caption"
                  num
                  tone={
                    num(alt.protein_g) > num(g.dish.protein_g)
                      ? 'success'
                      : num(alt.protein_g) < num(g.dish.protein_g)
                        ? 'danger'
                        : 'secondary'
                  }
                  style={styles.delta}
                >
                  {signed(num(alt.protein_g) - num(g.dish.protein_g), ' g')}
                </Text>
              </Pressable>
            ))}
            {g.alternatives.length === 0 ? (
              <Text variant="caption" tone="secondary">
                No swaps set. Add one in the plan editor.
              </Text>
            ) : null}
            <Text variant="sub" weight={600}>{`${g.dish.name} portion`}</Text>
            <SegmentedToggle
              accessibilityLabel={`${g.dish.name} portion`}
              options={PORTION_OPTIONS}
              value={g.log ? String(portion) : ''}
              onChange={(v) => void actions.setPortion(view, g, Number(v) as Portion)}
            />
          </Card>
        );
      })}

      {view.groups.length > 0 && ticked < view.groups.length ? (
        <Button
          label="Eaten as planned"
          accessibilityLabel={`${view.name} eaten as planned`}
          onPress={() => void actions.eatMeal(view)}
          fullWidth
          size="lg"
        />
      ) : null}

      {swapping ? (
        <SwapSheet
          view={view}
          group={swapping.group}
          initialDishId={swapping.dishId}
          dayPlannedKcal={food.day.planned.kcal}
          kcalTarget={food.kcalTarget}
          onClose={() => setSwapping(null)}
          onSwap={(to, makeDefault) => {
            const g = swapping.group;
            setSwapping(null);
            void actions.swap(view, g, to, makeDefault);
          }}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  tiles: { flexDirection: 'row', gap: 8 },
  flex: { flex: 1, minWidth: 0 },
  edit: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swaps: { position: 'absolute', right: 16, top: 16 },
  chosen: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  right: { alignItems: 'flex-end' },
  alt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderTopWidth: 1,
    paddingVertical: 12,
    minHeight: 44,
  },
  delta: { width: 48, textAlign: 'right' },
});
