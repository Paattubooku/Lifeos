import { Check, ChevronRight, Repeat } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { istClock } from '@/lib/dates';
import { formatClock } from '@/lib/format';
import { hhmm } from '@/features/routine/lib/blocks';
import { Button, Card, Checkbox, StatusChip, type StatusTone, Text, useTheme } from '@/ui';

import { type GroupView, type MealStatus, type MealView, num, PORTIONS } from '../lib/plan';

const STATUS: Record<MealStatus, { label: string; tone: StatusTone; beacon?: boolean }> = {
  eaten: { label: 'Eaten', tone: 'success' },
  partly: { label: 'Partly eaten', tone: 'calories' },
  now: { label: 'Now', tone: 'primary', beacon: true },
  upcoming: { label: 'Upcoming', tone: 'neutral' },
  missed: { label: 'Not logged', tone: 'danger' },
};

export const portionLabel = (p: number) => PORTIONS.find((x) => x.value === p)?.label ?? String(p);

/** One meal on the Food tab: dishes with ticks, swap buttons, "Eaten as planned" (Food-Tab design). */
export function MealCard({
  view,
  onOpen,
  onEat,
  onToggle,
  onSwap,
}: {
  view: MealView;
  onOpen: () => void;
  onEat: () => void;
  onToggle: (g: GroupView) => void;
  onSwap: (g: GroupView) => void;
}) {
  const { colors } = useTheme();
  const [time, period] = formatClock(hhmm(view.meal.time)).split(' ') as [string, string];
  const s = STATUS[view.status];
  const touched = view.status === 'eaten' || view.status === 'partly';
  const totals = touched ? view.eaten : view.planned;
  const ticked = view.groups.filter((g) => g.log && num(g.log.portion) > 0).length;
  return (
    <Card
      testID={`meal-${view.meal.slot}`}
      style={
        view.status === 'now'
          ? { borderColor: colors.accents.primary.base, borderWidth: 1.5 }
          : undefined
      }
    >
      <Pressable
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={`${view.name}, ${s.label}, ${totals.kcal} kcal, ${totals.protein} g protein. Open`}
        style={styles.head}
      >
        <View style={styles.time}>
          <Text variant="sub" weight={700} num>
            {time}
          </Text>
          <Text variant="caption" tone="secondary">
            {period.toUpperCase()}
          </Text>
        </View>
        <View style={styles.flex}>
          <View style={styles.titleRow}>
            <Text variant="heading">{view.name}</Text>
            <StatusChip label={s.label.toUpperCase()} tone={s.tone} beacon={s.beacon} />
          </View>
          <Text variant="sub" num>
            <Text variant="sub" weight={700} num>{`${totals.kcal} kcal `}</Text>
            <Text variant="sub" tone="protein" weight={700} num>{`${totals.protein} g`}</Text>
          </Text>
        </View>
        <ChevronRight size={18} color={colors.textSecondary} strokeWidth={2} />
      </Pressable>

      {view.groups.map((g) => {
        const portion = g.log ? num(g.log.portion) : 1;
        const shownKcal = g.log ? g.log.kcal : g.dish.kcal;
        const shownProtein = g.log
          ? Math.round(num(g.log.protein_g))
          : Math.round(num(g.dish.protein_g));
        return (
          <View key={g.group} style={[styles.dish, { borderTopColor: colors.hairline }]}>
            <Checkbox
              checked={Boolean(g.log) && portion > 0}
              onToggle={() => onToggle(g)}
              accessibilityLabel={`${g.log ? 'Untick' : 'Tick'} ${g.dish.name}`}
            />
            <View style={styles.flex}>
              <Text
                variant="body"
                weight={600}
                tone={g.log && portion === 0 ? 'secondary' : 'default'}
                strike={Boolean(g.log) && portion === 0}
              >
                {g.dish.name}
              </Text>
              <Text variant="caption" tone="secondary">
                {g.dish.serving_text}
                {g.log && portion < 1 ? (
                  <Text
                    variant="caption"
                    tone="calories"
                    weight={700}
                  >{` · ate ${portionLabel(portion)}`}</Text>
                ) : null}
              </Text>
            </View>
            <View style={styles.numbers}>
              <Text variant="sub" weight={700} num>{`${shownKcal} kcal`}</Text>
              <Text variant="caption" tone="protein" weight={700} num>{`${shownProtein} g`}</Text>
            </View>
            {g.alternatives.length > 0 ? (
              <Pressable
                onPress={() => onSwap(g)}
                accessibilityRole="button"
                accessibilityLabel={`Swap ${g.dish.name}`}
                hitSlop={8}
                style={styles.swap}
              >
                <Repeat size={18} color={colors.accents.primary.base} strokeWidth={2} />
              </Pressable>
            ) : null}
          </View>
        );
      })}

      {view.groups.length === 0 ? (
        <Text variant="sub" tone="secondary">
          No dishes yet — add some in the meal plan.
        </Text>
      ) : view.status === 'eaten' || ticked === view.groups.length ? (
        <Text variant="caption" tone="secondary">
          {`Ticked ${view.tickedAt ? formatClock(istClock(view.tickedAt)) : ''} · all ${view.groups.length} dishes`}
        </Text>
      ) : (
        <Button
          variant={view.status === 'now' ? 'primary' : 'outline'}
          icon={Check}
          label="Eaten as planned"
          accessibilityLabel={`${view.name} eaten as planned`}
          onPress={onEat}
          fullWidth
        />
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  time: { width: 44 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  flex: { flex: 1, minWidth: 0 },
  dish: { flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: 1, paddingTop: 8 },
  numbers: { alignItems: 'flex-end' },
  swap: { width: 32, height: 44, alignItems: 'center', justifyContent: 'center' },
});
