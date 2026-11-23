import { dayMinutes, hhmm } from '@/features/routine/lib/blocks';

export type Portion = 1 | 0.75 | 0.5 | 0;
export const PORTIONS: readonly { value: Portion; label: string }[] = [
  { value: 1, label: 'All' },
  { value: 0.75, label: '¾' },
  { value: 0.5, label: '½' },
  { value: 0, label: 'None' },
];

export type DishRow = {
  id: string;
  client_id: string;
  name: string;
  serving_text: string;
  kcal: number;
  protein_g: number | string;
  carbs_g: number | string;
  fat_g: number | string;
  buy: string;
  shopping_items: unknown;
  deleted_at?: string | null;
};
export type MealRow = {
  id: string;
  client_id: string;
  plan_id: string;
  slot: string;
  time: string;
  sort: number;
  deleted_at?: string | null;
};
export type ItemRow = {
  id: string;
  client_id: string;
  meal_id: string;
  dish_id: string;
  swap_group: string;
  is_default: boolean;
  sort: number;
  deleted_at?: string | null;
};
export type MealPlanFull = {
  plan: { id: string; client_id: string; name: string } | null;
  meals: MealRow[];
  items: ItemRow[];
  dishes: DishRow[];
};

export type FoodLogRow = {
  client_id: string;
  date: string;
  meal_id: string | null;
  dish_id: string | null;
  swap_group: string | null;
  free_text?: string | null;
  portion: number | string;
  kcal: number;
  protein_g: number | string;
  is_off_plan?: boolean;
  logged_at: string;
  deleted_at?: string | null;
};

/** Today-only choices made before eating: meal id → swap group → dish id. */
export type DaySwaps = Record<string, Record<string, string>>;

export const SLOT_NAME: Record<string, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  snack: 'Snack',
  dinner: 'Dinner',
};

export const num = (v: number | string | null | undefined) => Number(v ?? 0);

/** kcal / protein / carbs / fat of a dish at a portion (stored values round like the DB). */
export function scaled(
  dish: Pick<DishRow, 'kcal' | 'protein_g' | 'carbs_g' | 'fat_g'>,
  portion: number,
) {
  return {
    kcal: Math.round(dish.kcal * portion),
    protein: Math.round(num(dish.protein_g) * portion * 10) / 10,
    carbs: Math.round(num(dish.carbs_g) * portion * 10) / 10,
    fat: Math.round(num(dish.fat_g) * portion * 10) / 10,
  };
}

export type GroupView = {
  group: string;
  /** The dish shown: the eaten one, else today's swap, else the default. */
  dish: DishRow;
  defaultDish: DishRow;
  alternatives: DishRow[];
  log: FoodLogRow | null;
  portion: number;
};

export type MealStatus = 'eaten' | 'partly' | 'now' | 'upcoming' | 'missed';

export type MealView = {
  meal: MealRow;
  name: string;
  groups: GroupView[];
  planned: { kcal: number; protein: number };
  eaten: { kcal: number; protein: number };
  status: MealStatus;
  tickedAt: string | null;
  /** Off-plan entries logged to this meal (F09). */
  offPlan: FoodLogRow[];
};

const live = <T extends { deleted_at?: string | null }>(rows: readonly T[]) =>
  rows.filter((r) => !r.deleted_at);

/** A meal's "now" window: its time + 60 min (then it's "missed" until eaten). */
export const MEAL_WINDOW_MIN = 60;

export function mealView(
  meal: MealRow,
  plan: MealPlanFull,
  logs: readonly FoodLogRow[],
  swaps: DaySwaps,
  nowMin: number,
): MealView {
  const dishes = new Map(live(plan.dishes).map((d) => [d.id, d]));
  const items = live(plan.items)
    .filter((i) => i.meal_id === meal.id && dishes.has(i.dish_id))
    .sort((a, b) => a.sort - b.sort);
  const mealLogs = live(logs).filter((l) => l.meal_id === meal.id && !l.is_off_plan);
  const offPlan = live(logs)
    .filter((l) => l.meal_id === meal.id && l.is_off_plan)
    .sort((a, b) => a.logged_at.localeCompare(b.logged_at));
  const order: string[] = [];
  for (const i of items) if (!order.includes(i.swap_group)) order.push(i.swap_group);

  const groups: GroupView[] = [];
  for (const group of order) {
    const inGroup = items.filter((i) => i.swap_group === group);
    const def = inGroup.find((i) => i.is_default) ?? inGroup[0]!;
    const defaultDish = dishes.get(def.dish_id)!;
    const log = mealLogs.find((l) => l.swap_group === group) ?? null;
    const chosenId = log?.dish_id ?? swaps[meal.id]?.[group] ?? def.dish_id;
    const dish = dishes.get(chosenId) ?? defaultDish;
    groups.push({
      group,
      dish,
      defaultDish,
      alternatives: inGroup.filter((i) => i.dish_id !== dish.id).map((i) => dishes.get(i.dish_id)!),
      log,
      portion: log ? num(log.portion) : 1,
    });
  }

  const planned = groups.reduce(
    (s, g) => ({ kcal: s.kcal + g.dish.kcal, protein: s.protein + num(g.dish.protein_g) }),
    { kcal: 0, protein: 0 },
  );
  const eatenLogs = mealLogs.filter((l) => num(l.portion) > 0);
  const eaten = [...mealLogs, ...offPlan].reduce(
    (s, l) => ({ kcal: s.kcal + l.kcal, protein: s.protein + num(l.protein_g) }),
    { kcal: 0, protein: 0 },
  );
  const allFull = groups.length > 0 && groups.every((g) => g.log && num(g.log.portion) === 1);
  // An off-plan meal that replaced the plan (every dish logged, some at 0) counts as eaten.
  const replaced = offPlan.length > 0 && groups.every((g) => g.log);
  const start = dayMinutes(hhmm(meal.time));
  const status: MealStatus =
    allFull || replaced
      ? 'eaten'
      : mealLogs.length > 0 || offPlan.length > 0
        ? 'partly'
        : nowMin < start
          ? 'upcoming'
          : nowMin < start + MEAL_WINDOW_MIN
            ? 'now'
            : 'missed';
  const times = [...eatenLogs, ...offPlan].map((l) => l.logged_at).sort();
  return {
    meal,
    name: SLOT_NAME[meal.slot] ?? meal.slot,
    groups,
    planned: { kcal: planned.kcal, protein: Math.round(planned.protein) },
    eaten: { kcal: eaten.kcal, protein: Math.round(eaten.protein) },
    status,
    tickedAt: times[times.length - 1] ?? null,
    offPlan,
  };
}

export type DayFood = {
  meals: MealView[];
  /** Off-plan entries not tied to a meal ("Other"). */
  other: FoodLogRow[];
  eaten: { kcal: number; protein: number; carbs: number; fat: number };
  /** Plan for the whole day (what the meals add up to with today's choices). */
  planned: { kcal: number; protein: number };
  /** Where the day lands: eaten + what's left of the plan. */
  projected: { kcal: number; protein: number };
  /** "Should have eaten by now": planned kcal/protein of meals already due. */
  pace: { kcal: number; protein: number };
};

/** The day's food: meals in time order, totals, projection and pace (Food tab). */
export function dayFood(
  plan: MealPlanFull,
  logs: readonly FoodLogRow[],
  swaps: DaySwaps,
  nowMin: number,
): DayFood {
  const meals = live(plan.meals)
    .sort((a, b) => dayMinutes(hhmm(a.time)) - dayMinutes(hhmm(b.time)) || a.sort - b.sort)
    .map((m) => mealView(m, plan, logs, swaps, nowMin));
  const dishes = new Map(plan.dishes.map((d) => [d.id, d]));
  const liveLogs = live(logs);
  const eaten = liveLogs.reduce(
    (s, l) => {
      const d = l.dish_id ? dishes.get(l.dish_id) : undefined;
      const p = num(l.portion);
      return {
        kcal: s.kcal + l.kcal,
        protein: s.protein + num(l.protein_g),
        carbs: s.carbs + (d ? num(d.carbs_g) * p : 0),
        fat: s.fat + (d ? num(d.fat_g) * p : 0),
      };
    },
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  );
  const sum = (ms: MealView[], f: (m: MealView) => { kcal: number; protein: number }) =>
    ms.reduce((s, m) => ({ kcal: s.kcal + f(m).kcal, protein: s.protein + f(m).protein }), {
      kcal: 0,
      protein: 0,
    });
  const untouched = meals.filter((m) => m.status === 'upcoming' || m.status === 'now');
  const left = sum(untouched, (m) => m.planned);
  const due = meals.filter((m) => dayMinutes(hhmm(m.meal.time)) <= nowMin);
  const mealIds = new Set(meals.map((m) => m.meal.id));
  const other = liveLogs
    .filter((l) => l.is_off_plan && (!l.meal_id || !mealIds.has(l.meal_id)))
    .sort((a, b) => a.logged_at.localeCompare(b.logged_at));
  return {
    meals,
    other,
    eaten: {
      kcal: eaten.kcal,
      protein: Math.round(eaten.protein),
      carbs: Math.round(eaten.carbs),
      fat: Math.round(eaten.fat),
    },
    planned: sum(meals, (m) => m.planned),
    projected: { kcal: eaten.kcal + left.kcal, protein: Math.round(eaten.protein) + left.protein },
    pace: sum(due, (m) => m.planned),
  };
}
