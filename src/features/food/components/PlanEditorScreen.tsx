import { useRouter } from 'expo-router';
import { ChevronRight, Plus, Repeat, X } from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useProfile } from '@/features/profile/hooks/useProfileData';
import { hhmm } from '@/features/routine/lib/blocks';
import { applyChanges } from '@/features/routine/slice';
import { formatClock, formatIndianNumber } from '@/lib/format';
import { useAppDispatch } from '@/store';
import { Button, Card, EmptyState, Screen, StatTile, Text, useSnackbar, useTheme } from '@/ui';

import { useMealPlan } from '../hooks/useFood';
import { planRemoveItem, planRestoreItems } from '../lib/dishes';
import { dayFood, type ItemRow, num, SLOT_NAME } from '../lib/plan';

/** More → Meal plan (Food-PlanEditor design): meals, their dishes and swap groups. */
export function PlanEditorScreen() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const showSnackbar = useSnackbar();
  const { colors } = useTheme();
  const { plan } = useMealPlan();
  const { profile } = useProfile();
  const latest = useRef(plan);
  useEffect(() => {
    latest.current = plan;
  });

  const day = dayFood(plan, [], {}, 0);
  const kcalTarget = profile?.kcal_target ?? 2200;
  const proteinTarget = profile?.protein_target_g ?? 150;
  const dishCount = new Set(plan.items.map((i) => i.dish_id)).size;
  const dishes = new Map(plan.dishes.map((d) => [d.id, d]));
  const back = { label: 'Back', onPress: () => router.back() };

  const remove = async (item: ItemRow) => {
    const before = plan.items.filter((i) => i.meal_id === item.meal_id);
    await dispatch(applyChanges(planRemoveItem(item, plan.items)));
    showSnackbar({
      message: `${dishes.get(item.dish_id)?.name ?? 'Dish'} removed`,
      actionLabel: 'Undo',
      onAction: () => {
        const now = latest.current.items.filter((i) => i.meal_id === item.meal_id);
        const removed = before
          .filter((b) => !now.some((n) => n.id === b.id))
          .map((b) => ({ ...b, deleted_at: 'x' }));
        void dispatch(applyChanges(planRestoreItems(before, [...now, ...removed])));
      },
    });
  };

  if (!plan.plan) {
    return (
      <Screen title="Meal plan" withTabBar={false} back={back}>
        <EmptyState
          icon={Plus}
          title="No active meal plan"
          body="Sign in again to create the default plan."
        />
      </Screen>
    );
  }

  const kcalDiff = day.planned.kcal - kcalTarget;
  const proteinDiff = day.planned.protein - proteinTarget;
  return (
    <Screen
      title="Meal plan"
      subtitle={`${plan.plan.name} · ${day.meals.length} meals · ${dishCount} dishes · every day`}
      withTabBar={false}
      back={back}
    >
      <Card>
        <View style={styles.tiles}>
          <StatTile
            label="Plan kcal"
            accent="calories"
            value={formatIndianNumber(day.planned.kcal)}
            sub={`target ${formatIndianNumber(kcalTarget)}`}
            style={styles.flex}
          />
          <StatTile
            label="Plan protein"
            accent="protein"
            value={`${day.planned.protein} g`}
            sub={`target ${proteinTarget} g`}
            style={styles.flex}
          />
        </View>
        <Text variant="sub" tone="secondary" num>
          {`${Math.abs(kcalDiff)} kcal ${kcalDiff >= 0 ? 'over' : 'under'} target, ${Math.abs(proteinDiff)} g protein ${proteinDiff >= 0 ? 'over' : 'under'}. Default dishes, coffee not included.`}
        </Text>
      </Card>

      {day.meals.map((m) => {
        const items = plan.items
          .filter((i) => i.meal_id === m.meal.id)
          .sort(
            (a, b) =>
              (a.swap_group === b.swap_group ? Number(b.is_default) - Number(a.is_default) : 0) ||
              a.sort - b.sort,
          );
        const groupSize = (g: string) => items.filter((i) => i.swap_group === g).length;
        return (
          <Card key={m.meal.id} padding={14} gap={4} testID={`plan-${m.meal.slot}`}>
            <View style={styles.head}>
              <Text variant="heading">{SLOT_NAME[m.meal.slot] ?? m.meal.slot}</Text>
              <Text
                variant="sub"
                tone="secondary"
                style={styles.flex}
              >{` ${formatClock(hhmm(m.meal.time))}`}</Text>
              <Text variant="sub" weight={700} num>{`${m.planned.kcal} kcal `}</Text>
              <Text variant="sub" weight={700} tone="protein" num>{`${m.planned.protein} g`}</Text>
            </View>
            {items.map((i) => {
              const d = dishes.get(i.dish_id);
              if (!d) return null;
              return (
                <View key={i.id} style={[styles.row, { borderTopColor: colors.hairline }]}>
                  <Pressable
                    style={styles.main}
                    accessibilityRole="button"
                    accessibilityLabel={`${d.name}, ${i.swap_group}${i.is_default ? ', default' : ', swap'}, ${d.kcal} kcal. Edit`}
                    onPress={() =>
                      router.push({
                        pathname: '/dish/[id]',
                        params: { id: d.id, meal: m.meal.id, item: i.id },
                      })
                    }
                  >
                    <View style={styles.flex}>
                      <Text
                        variant="body"
                        weight={i.is_default ? 600 : 400}
                        tone={i.is_default ? 'default' : 'secondary'}
                      >
                        {d.name}
                      </Text>
                      <View style={styles.meta}>
                        <Text variant="caption" tone="secondary">
                          {[d.serving_text, i.swap_group].filter(Boolean).join(' · ')}
                        </Text>
                        {groupSize(i.swap_group) > 1 && i.is_default ? (
                          <>
                            <Repeat size={12} color={colors.accents.primary.base} strokeWidth={2} />
                            <Text variant="caption" tone="primary">
                              swaps
                            </Text>
                          </>
                        ) : null}
                      </View>
                    </View>
                    <View style={styles.right}>
                      <Text variant="sub" weight={700} num>{`${d.kcal} kcal`}</Text>
                      <Text
                        variant="caption"
                        tone="protein"
                        weight={700}
                        num
                      >{`${Math.round(num(d.protein_g))} g`}</Text>
                    </View>
                    <ChevronRight size={18} color={colors.textSecondary} strokeWidth={2} />
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${d.name} from ${SLOT_NAME[m.meal.slot] ?? m.meal.slot}`}
                    onPress={() => void remove(i)}
                    hitSlop={6}
                    style={styles.x}
                  >
                    <X size={16} color={colors.textSecondary} strokeWidth={2} />
                  </Pressable>
                </View>
              );
            })}
            <Button
              variant="ghost"
              size="sm"
              icon={Plus}
              label="Add dish"
              accessibilityLabel={`Add a dish to ${SLOT_NAME[m.meal.slot] ?? m.meal.slot}`}
              onPress={() =>
                router.push({ pathname: '/dish/[id]', params: { id: 'new', meal: m.meal.id } })
              }
            />
          </Card>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  tiles: { flexDirection: 'row', gap: 8 },
  flex: { flex: 1, minWidth: 0 },
  head: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1 },
  main: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    minHeight: 52,
  },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  right: { alignItems: 'flex-end' },
  x: { width: 36, height: 44, alignItems: 'center', justifyContent: 'center' },
});
