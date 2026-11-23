import { useRouter } from 'expo-router';
import { Pencil, Plus, Soup } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useNow } from '@/features/today/hooks/useNow';
import { dayKicker } from '@/features/today/lib/present';
import { istClock, isoWeekday } from '@/lib/dates';
import { formatClock } from '@/lib/format';
import { Button, Card, EmptyState, Screen, Text, useTheme } from '@/ui';

import { useFood } from '../hooks/useFood';
import { useFoodActions } from '../hooks/useFoodActions';
import type { GroupView, MealView } from '../lib/plan';
import { COFFEE_KCAL, coffeeLine, coffeeState } from '../lib/extras';
import { CoffeeChip } from './CoffeeChip';
import { MealCard } from './MealCard';
import { OffPlanRows } from './OffPlanRows';
import { OffPlanSheet } from './OffPlanSheet';
import { SwapSheet } from './SwapSheet';
import { TotalsCard } from './TotalsCard';

/** Food tab (Food-Tab design): eaten-today bars, insights, the four meals. */
export function FoodScreen({ now: fixedNow }: { now?: number } = {}) {
  const ticking = useNow();
  const now = fixedNow ?? ticking;
  const router = useRouter();
  const { colors } = useTheme();
  const food = useFood(now);
  const actions = useFoodActions(food);
  const [swapping, setSwapping] = useState<{ view: MealView; group: GroupView } | null>(null);
  const [offPlan, setOffPlan] = useState<{ mealId: string | null } | null>(null);
  // Default slot for "+ Off-plan": the meal that's on now, else the next one, else Other.
  const defaultMealId =
    food.day.meals.find((m) => m.status === 'now')?.meal.id ??
    food.day.meals.find((m) => m.status === 'upcoming')?.meal.id ??
    null;

  const kicker = `${dayKicker(food.today, isoWeekday(food.today), 0, 0).split(' · ')[0]} · ${formatClock(istClock(now)).toUpperCase()}`;
  const hasPlan = food.day.meals.some((m) => m.groups.length > 0);
  const planButton = (
    <View style={styles.header}>
      <CoffeeChip
        count={food.coffees.length}
        limit={food.coffeeLimit}
        onAdd={() => void actions.addCoffee()}
        onRemove={() => void actions.removeCoffee()}
      />
      <Button
        variant="secondary"
        size="sm"
        icon={Pencil}
        label="Plan"
        accessibilityLabel="Edit meal plan"
        onPress={() => router.push('/meal-plan')}
      />
    </View>
  );

  if (food.isLoading && !hasPlan) {
    return (
      <Screen title="Food" kicker={kicker} accessory={planButton}>
        <ActivityIndicator color={colors.accents.primary.base} accessibilityLabel="Loading" />
      </Screen>
    );
  }

  return (
    <Screen title="Food" kicker={kicker} accessory={planButton}>
      <TotalsCard
        day={food.day}
        kcalTarget={food.kcalTarget}
        proteinTarget={food.proteinTarget}
        chips={food.chips}
        hasPlan={hasPlan}
      />
      <Button
        variant="secondary"
        icon={Plus}
        label="Off-plan"
        accessibilityLabel="Log off-plan food"
        onPress={() => setOffPlan({ mealId: defaultMealId })}
      />
      {hasPlan ? (
        food.day.meals.map((m) => (
          <MealCard
            key={m.meal.id}
            view={m}
            onOpen={() => router.push({ pathname: '/meal/[slot]', params: { slot: m.meal.slot } })}
            onEat={() => void actions.eatMeal(m)}
            onToggle={(g) => void actions.toggleDish(m, g)}
            onSwap={(g) => setSwapping({ view: m, group: g })}
            onOffPlan={() => setOffPlan({ mealId: m.meal.id })}
            onRemoveOffPlan={(l) => void actions.removeOffPlan(l)}
          />
        ))
      ) : (
        <Card>
          <EmptyState
            icon={Soup}
            title="No meal plan yet"
            body="Add meals and dishes to track food against your plan."
            action={{
              label: 'Open meal plan',
              accessibilityLabel: 'Open meal plan',
              onPress: () => router.push('/meal-plan'),
            }}
          />
        </Card>
      )}
      {food.day.other.length > 0 ? (
        <Card title="Other" testID="other-food">
          <OffPlanRows logs={food.day.other} onRemove={(l) => void actions.removeOffPlan(l)} />
        </Card>
      ) : null}

      <Card kicker="Coffee" testID="coffee-card">
        <Text
          variant="sub"
          tone={
            coffeeState(food.coffees.length, food.coffeeLimit) === 'over'
              ? 'danger'
              : coffeeState(food.coffees.length, food.coffeeLimit) === 'at'
                ? 'calories'
                : 'default'
          }
        >
          {coffeeLine(food.coffees.length, food.coffeeLimit)}
        </Text>
        <Text variant="caption" tone="secondary">
          {`Tap the cup chip to add one, hold it to remove one. Over the limit it still logs, with a warning. Each coffee is ${COFFEE_KCAL} kcal, 0 g protein (black, half sugar).`}
        </Text>
      </Card>

      {offPlan ? (
        <OffPlanSheet
          meals={food.day.meals}
          initialMealId={offPlan.mealId}
          eaten={food.day.eaten}
          kcalTarget={food.kcalTarget}
          proteinTarget={food.proteinTarget}
          onClose={() => setOffPlan(null)}
          onAdd={(input, meal) => {
            setOffPlan(null);
            void actions.addOffPlan(input, meal);
          }}
        />
      ) : null}

      {swapping ? (
        <SwapSheet
          view={swapping.view}
          group={swapping.group}
          dayPlannedKcal={food.day.planned.kcal}
          kcalTarget={food.kcalTarget}
          onClose={() => setSwapping(null)}
          onSwap={(to, makeDefault) => {
            const s = swapping;
            setSwapping(null);
            void actions.swap(s.view, s.group, to, makeDefault);
          }}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
