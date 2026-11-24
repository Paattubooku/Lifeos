import { Plus } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { formatIndianNumber } from '@/lib/format';
import { Button, Chip, NumberStepper, SegmentedToggle, Sheet, Text, TextField, Toggle } from '@/ui';

import { OFF_PLAN_CHIPS, type OffPlanInput, validateOffPlan } from '../lib/extras';
import type { MealView } from '../lib/plan';

const OTHER = 'other';

/** Food-OffPlanSheet design: what, kcal (chips or stepper), protein, meal slot, replaces the plan. */
export function OffPlanSheet({
  meals,
  initialMealId,
  eaten,
  kcalTarget,
  proteinTarget,
  onAdd,
  onClose,
}: {
  meals: readonly MealView[];
  initialMealId: string | null;
  eaten: { kcal: number; protein: number };
  kcalTarget: number;
  proteinTarget: number;
  onAdd: (input: OffPlanInput, meal: MealView | null) => void;
  onClose: () => void;
}) {
  const { height } = useWindowDimensions();
  const [text, setText] = useState('');
  const [kcal, setKcal] = useState(250);
  const [protein, setProtein] = useState('');
  const [slot, setSlot] = useState<string>(initialMealId ?? OTHER);
  const [replaces, setReplaces] = useState(false);

  const meal = meals.find((m) => m.meal.id === slot) ?? null;
  const proteinNum = protein.trim() === '' ? null : Number(protein.replace(',', '.'));
  const error = validateOffPlan({ text, kcal, protein: proteinNum });
  const canReplace = Boolean(meal && meal.groups.some((g) => !g.log));
  const options = [
    ...meals.map((m) => ({ value: m.meal.id, label: m.name })),
    { value: OTHER, label: 'Other' },
  ];

  return (
    <Sheet
      visible
      onClose={onClose}
      title="Log off-plan"
      subtitle={`After this: ${formatIndianNumber(eaten.kcal + kcal)} / ${formatIndianNumber(kcalTarget)} kcal · ${Math.round(
        eaten.protein + (proteinNum ?? 0),
      )} / ${proteinTarget} g`}
      testID="offplan-sheet"
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        style={{ maxHeight: height * 0.62 }}
        contentContainerStyle={styles.content}
      >
        <TextField
          label="What did you eat?"
          value={text}
          onChangeText={setText}
          placeholder="e.g. Masala vada ×2 (office pantry)"
          maxLength={80}
        />
        <Text variant="sub" weight={600}>
          Calories
        </Text>
        <View style={styles.chips}>
          {OFF_PLAN_CHIPS.map((k) => (
            <View key={k} style={styles.flex}>
              <Chip
                label={String(k)}
                selected={kcal === k}
                accessibilityLabel={`${k} kilocalories`}
                onPress={() => setKcal(k)}
              />
            </View>
          ))}
        </View>
        <NumberStepper
          value={kcal}
          onChange={setKcal}
          accessibilityLabel="Calories"
          step={10}
          min={10}
          max={5000}
          unit="kcal"
        />
        <TextField
          label="Protein (optional, g)"
          value={protein}
          onChangeText={(v) => setProtein(v.replace(/[^0-9.,]/g, ''))}
          keyboardType="decimal-pad"
          maxLength={5}
        />
        <Text variant="sub" weight={600}>
          Meal slot
        </Text>
        <SegmentedToggle
          accessibilityLabel="Meal slot"
          options={options}
          value={slot}
          onChange={(v) => {
            setSlot(v);
            setReplaces(false);
          }}
        />
        {meal ? (
          <Toggle
            label={`Replaces planned ${meal.name.toLowerCase()}`}
            hint={
              canReplace
                ? replaces
                  ? `On: the planned dishes count as not eaten.`
                  : `Off: adds on top of the ${formatIndianNumber(meal.planned.kcal)} kcal ${meal.name.toLowerCase()} plan.`
                : 'Everything planned is already logged.'
            }
            value={replaces}
            onChange={setReplaces}
            disabled={!canReplace}
            testID="toggle-replaces"
          />
        ) : null}
        {error && text.length > 0 ? (
          <Text variant="caption" tone="danger" testID="offplan-error">
            {error}
          </Text>
        ) : null}
      </ScrollView>
      <Button
        icon={Plus}
        label={`Add ${formatIndianNumber(kcal)} kcal to ${meal ? meal.name : 'Other'}`}
        accessibilityLabel={`Add ${kcal} kilocalories to ${meal ? meal.name : 'Other'}`}
        disabled={error !== null}
        onPress={() =>
          onAdd(
            {
              text,
              kcal,
              protein: proteinNum,
              mealId: meal?.meal.id ?? null,
              replaces: replaces && canReplace,
            },
            meal,
          )
        }
        fullWidth
        size="lg"
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  content: { gap: 14, paddingBottom: 8 },
  chips: { flexDirection: 'row', gap: 8 },
  flex: { flex: 1 },
});
