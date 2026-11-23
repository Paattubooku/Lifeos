import { useRouter } from 'expo-router';
import { Pencil, Soup } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator } from 'react-native';

import { useNow } from '@/features/today/hooks/useNow';
import { dayKicker } from '@/features/today/lib/present';
import { istClock, isoWeekday } from '@/lib/dates';
import { formatClock } from '@/lib/format';
import { Button, Card, EmptyState, Screen, useTheme } from '@/ui';

import { useFood } from '../hooks/useFood';
import { useFoodActions } from '../hooks/useFoodActions';
import type { GroupView, MealView } from '../lib/plan';
import { MealCard } from './MealCard';
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

  const kicker = `${dayKicker(food.today, isoWeekday(food.today), 0, 0).split(' · ')[0]} · ${formatClock(istClock(now)).toUpperCase()}`;
  const hasPlan = food.day.meals.some((m) => m.groups.length > 0);
  const planButton = (
    <Button
      variant="secondary"
      size="sm"
      icon={Pencil}
      label="Plan"
      accessibilityLabel="Edit meal plan"
      onPress={() => router.push('/meal-plan')}
    />
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
      {hasPlan ? (
        food.day.meals.map((m) => (
          <MealCard
            key={m.meal.id}
            view={m}
            onOpen={() => router.push({ pathname: '/meal/[slot]', params: { slot: m.meal.slot } })}
            onEat={() => void actions.eatMeal(m)}
            onToggle={(g) => void actions.toggleDish(m, g)}
            onSwap={(g) => setSwapping({ view: m, group: g })}
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
