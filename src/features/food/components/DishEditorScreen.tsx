import { useRouter } from 'expo-router';
import { Check, Plus, TriangleAlert, X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { applyChanges } from '@/features/routine/slice';
import { newClientId } from '@/lib/ids';
import { useAppDispatch } from '@/store';
import {
  Banner,
  Button,
  Card,
  Chip,
  EmptyState,
  Screen,
  SegmentedToggle,
  Text,
  TextField,
  useSnackbar,
  useTheme,
} from '@/ui';

import { useMealPlan } from '../hooks/useFood';
import {
  BUY_OPTIONS,
  type Buy,
  type DishDraft,
  draftFromDish,
  EMPTY_DISH,
  groupsOf,
  macroCheck,
  planDeleteDish,
  planDishSave,
  planRestoreDish,
  planSetGroup,
  type ShoppingItem,
  validateDish,
} from '../lib/dishes';
import { SLOT_NAME } from '../lib/plan';

type NumKey = 'kcal' | 'protein_g' | 'carbs_g' | 'fat_g';
const NUMS: { key: NumKey; label: string; unit: string }[] = [
  { key: 'kcal', label: 'Calories', unit: 'kcal' },
  { key: 'protein_g', label: 'Protein', unit: 'g' },
  { key: 'carbs_g', label: 'Carbs', unit: 'g' },
  { key: 'fat_g', label: 'Fat', unit: 'g' },
];
const parse = (s: string) => (s.trim() === '' ? Number.NaN : Number(s.replace(',', '.')));

/** `/dish/[id]` (Food-DishEditor design): `id` = "new" to add a dish to `meal`. */
export function DishEditorScreen({
  id,
  mealId,
  itemId,
}: {
  id: string;
  mealId?: string;
  itemId?: string;
}) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const showSnackbar = useSnackbar();
  const { colors } = useTheme();
  const { plan } = useMealPlan();
  const dish = id === 'new' ? null : (plan.dishes.find((d) => d.id === id) ?? null);
  const item = itemId ? (plan.items.find((i) => i.id === itemId) ?? null) : null;
  const meal = plan.meals.find((m) => m.id === (mealId ?? item?.meal_id));
  const groups = meal ? groupsOf(meal.id, plan.items) : [];

  const start = dish ? draftFromDish(dish) : EMPTY_DISH;
  const [form, setForm] = useState({
    name: start.name,
    serving_text: start.serving_text,
    buy: start.buy,
    shopping: start.shopping_items,
    nums: Object.fromEntries(NUMS.map((n) => [n.key, dish ? String(start[n.key]) : ''])) as Record<
      NumKey,
      string
    >,
  });
  const [group, setGroup] = useState(item?.swap_group ?? groups[0] ?? 'main');
  const [newGroup, setNewGroup] = useState('');
  const [newItem, setNewItem] = useState<ShoppingItem>({ item: '', qty: '', unit: '' });
  const [busy, setBusy] = useState(false);

  const back = { label: 'Meal plan', onPress: () => router.back() };
  if (id !== 'new' && !dish) {
    return (
      <Screen title="Edit dish" withTabBar={false} back={back}>
        <EmptyState
          icon={TriangleAlert}
          title="Dish not found"
          body="It may have been deleted on another phone."
        />
      </Screen>
    );
  }

  const draft: DishDraft = {
    name: form.name,
    serving_text: form.serving_text,
    buy: form.buy,
    shopping_items: form.shopping,
    kcal: parse(form.nums.kcal),
    protein_g: parse(form.nums.protein_g),
    carbs_g: parse(form.nums.carbs_g),
    fat_g: parse(form.nums.fat_g),
  };
  const error = validateDish(draft);
  const check = error ? null : macroCheck(draft);
  const chosenGroup = (newGroup.trim() || group).trim();

  const save = async () => {
    setBusy(true);
    const changes = [
      ...planDishSave(dish, draft, {
        newDishId: newClientId(),
        newItemId: newClientId(),
        mealId: dish ? undefined : meal?.id,
        group: chosenGroup,
        items: plan.items,
      }),
      ...(item ? planSetGroup(item, chosenGroup, plan.items) : []),
    ];
    await dispatch(applyChanges(changes));
    setBusy(false);
    showSnackbar({ message: dish ? 'Dish saved' : 'Dish added' });
    router.back();
  };

  const remove = async () => {
    if (!dish) return;
    const before = plan.items.filter((i) => i.dish_id === dish.id);
    await dispatch(applyChanges(planDeleteDish(dish, plan.items)));
    showSnackbar({
      message: `${dish.name} deleted`,
      actionLabel: 'Undo',
      onAction: () =>
        void dispatch(
          applyChanges(
            planRestoreDish(
              dish,
              before,
              before.map((b) => ({ ...b, deleted_at: 'x' })),
            ),
          ),
        ),
    });
    router.back();
  };

  const subtitle = meal ? `${SLOT_NAME[meal.slot] ?? meal.slot} · from today on` : 'From today on';
  return (
    <Screen
      title={dish ? 'Edit dish' : 'New dish'}
      subtitle={subtitle}
      withTabBar={false}
      back={back}
    >
      <Card>
        <TextField
          label="Name"
          value={form.name}
          onChangeText={(name) => setForm((f) => ({ ...f, name }))}
          maxLength={80}
        />
        <TextField
          label="Serving"
          value={form.serving_text}
          onChangeText={(serving_text) => setForm((f) => ({ ...f, serving_text }))}
          placeholder="e.g. 200 g raw, 1 cup, 4 pcs"
          maxLength={60}
        />
      </Card>

      <Card kicker="Per serving">
        <View style={styles.grid}>
          {NUMS.map((n) => (
            <View key={n.key} style={styles.cell}>
              <TextField
                label={`${n.label} (${n.unit})`}
                value={form.nums[n.key]}
                onChangeText={(v) =>
                  setForm((f) => ({
                    ...f,
                    nums: { ...f.nums, [n.key]: v.replace(/[^0-9.,]/g, '') },
                  }))
                }
                keyboardType="decimal-pad"
                maxLength={6}
              />
            </View>
          ))}
        </View>
        {error && form.name.length > 0 ? (
          <Text variant="caption" tone="danger" testID="dish-error">
            {error}
          </Text>
        ) : check ? (
          <Banner
            tone={check.ok ? 'success' : 'warning'}
            icon={check.ok ? Check : TriangleAlert}
            title={check.text}
            testID="macro-check"
          />
        ) : null}
      </Card>

      <Card kicker="Buy frequency">
        <SegmentedToggle<Buy>
          accessibilityLabel="Buy frequency"
          options={BUY_OPTIONS}
          value={form.buy}
          onChange={(buy) => setForm((f) => ({ ...f, buy }))}
        />
      </Card>

      {meal ? (
        <Card kicker="Swap group">
          <Text variant="caption" tone="secondary">
            Dishes in the same group swap for each other; one is the default.
          </Text>
          <View style={styles.chips}>
            {groups.map((g) => (
              <Chip
                key={g}
                label={g}
                selected={!newGroup.trim() && group === g}
                accessibilityLabel={`Swap group ${g}`}
                onPress={() => {
                  setNewGroup('');
                  setGroup(g);
                }}
              />
            ))}
          </View>
          <TextField
            label="New group"
            value={newGroup}
            onChangeText={setNewGroup}
            placeholder="e.g. sweet"
            maxLength={30}
          />
        </Card>
      ) : null}

      <Card kicker="Shopping items · per serving" padding={14}>
        {form.shopping.map((s, i) => (
          <View key={`${s.item}-${i}`} style={[styles.shop, { borderTopColor: colors.hairline }]}>
            <Text variant="body" style={styles.flex}>
              {s.item}
            </Text>
            <Text variant="body" weight={700}>
              {[s.qty, s.unit].filter(Boolean).join(' ')}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Remove ${s.item}`}
              onPress={() =>
                setForm((f) => ({ ...f, shopping: f.shopping.filter((_, j) => j !== i) }))
              }
              style={styles.x}
            >
              <X size={16} color={colors.textSecondary} strokeWidth={2} />
            </Pressable>
          </View>
        ))}
        <View style={styles.addRow}>
          <View style={styles.flex2}>
            <TextField
              label="Item"
              value={newItem.item}
              onChangeText={(item) => setNewItem((n) => ({ ...n, item }))}
            />
          </View>
          <View style={styles.flex}>
            <TextField
              label="Qty"
              value={newItem.qty}
              onChangeText={(qty) => setNewItem((n) => ({ ...n, qty }))}
            />
          </View>
          <View style={styles.flex}>
            <TextField
              label="Unit"
              value={newItem.unit}
              onChangeText={(unit) => setNewItem((n) => ({ ...n, unit }))}
            />
          </View>
        </View>
        <Button
          variant="ghost"
          size="sm"
          icon={Plus}
          label="Add item"
          accessibilityLabel="Add shopping item"
          disabled={!newItem.item.trim()}
          onPress={() => {
            setForm((f) => ({ ...f, shopping: [...f.shopping, newItem] }));
            setNewItem({ item: '', qty: '', unit: '' });
          }}
        />
      </Card>

      <View style={styles.actions}>
        {dish ? (
          <Button
            variant="destructive"
            label="Delete dish"
            accessibilityLabel={`Delete ${dish.name}`}
            onPress={() => void remove()}
          />
        ) : null}
        <Button
          label={busy ? 'Saving…' : dish ? 'Save dish' : 'Add dish'}
          accessibilityLabel={dish ? 'Save dish' : 'Add dish'}
          disabled={busy || error !== null}
          onPress={() => void save()}
          style={styles.flex}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  cell: { width: '47%' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  shop: { flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: 1, minHeight: 44 },
  x: { width: 36, height: 44, alignItems: 'center', justifyContent: 'center' },
  addRow: { flexDirection: 'row', gap: 8 },
  flex: { flex: 1, minWidth: 0 },
  flex2: { flex: 2, minWidth: 0 },
  actions: { flexDirection: 'row', gap: 12 },
});
