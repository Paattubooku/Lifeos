import {
  Bus,
  Car,
  Ellipsis,
  Film,
  Fuel,
  Gift,
  GraduationCap,
  HeartPulse,
  House,
  type LucideIcon,
  Pill,
  Plane,
  Receipt,
  Shirt,
  ShoppingBag,
  ShoppingBasket,
  Smartphone,
  Soup,
  Utensils,
  Wallet,
  Zap,
} from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { type Palette, Text, useTheme, withAlpha } from '@/ui';

/** Icon keys stored in `expense_category.icon` (kebab-case lucide names). */
export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  'shopping-basket': ShoppingBasket,
  soup: Soup,
  utensils: Utensils,
  receipt: Receipt,
  zap: Zap,
  smartphone: Smartphone,
  bus: Bus,
  car: Car,
  fuel: Fuel,
  'heart-pulse': HeartPulse,
  pill: Pill,
  'shopping-bag': ShoppingBag,
  shirt: Shirt,
  gift: Gift,
  house: House,
  'graduation-cap': GraduationCap,
  film: Film,
  plane: Plane,
  wallet: Wallet,
  ellipsis: Ellipsis,
};
export const iconFor = (key: string | null | undefined): LucideIcon =>
  CATEGORY_ICONS[key ?? ''] ?? Ellipsis;

type CategoryRef = { id: string; name: string; sort: number } | null | undefined;

/**
 * A category's colour: the theme's validated chart hues in category order
 * (food, bills, transport, health, shopping); Other, Income and anything past
 * the fifth fall back to neutral grey (dataviz: no generated hues).
 */
export function categoryColor(
  c: CategoryRef,
  ordered: readonly { id: string; name: string }[],
  colors: Palette,
): string {
  if (!c || /^(other|income)$/i.test(c.name)) return colors.textSecondary;
  const i = ordered
    .filter((x) => !/^(other|income)$/i.test(x.name))
    .findIndex((x) => x.id === c.id);
  return i >= 0 && i < colors.chart.length ? colors.chart[i]! : colors.textSecondary;
}

/** Tinted square with the category glyph (Money designs). */
export function CategoryTile({
  icon,
  color,
  size = 36,
}: {
  icon: string | null | undefined;
  color: string;
  size?: number;
}) {
  return (
    <View
      style={[styles.tile, { width: size, height: size, backgroundColor: withAlpha(color, 0.14) }]}
      importantForAccessibility="no-hide-descendants"
    >
      <Glyph icon={iconFor(icon)} size={size * 0.47} color={color} />
    </View>
  );
}

function Glyph({ icon: Icon, size, color }: { icon: LucideIcon; size: number; color: string }) {
  return <Icon size={size} color={color} strokeWidth={2} />;
}

/** Small "SMS" / "MANUAL" source pill. */
export function SourcePill({ source }: { source: string }) {
  const { colors } = useTheme();
  const sms = source === 'sms';
  return (
    <View
      style={[styles.pill, { backgroundColor: sms ? colors.accents.water.tint : colors.recessed }]}
    >
      <PillText sms={sms} source={source} />
    </View>
  );
}

function PillText({ sms, source }: { sms: boolean; source: string }) {
  const { colors } = useTheme();
  return (
    <Text
      variant="caption"
      weight={700}
      style={[styles.pillText, { color: sms ? colors.accents.water.base : colors.textSecondary }]}
    >
      {source === 'sms' ? 'SMS' : source === 'quick' ? 'QUICK' : 'MANUAL'}
    </Text>
  );
}

const styles = StyleSheet.create({
  tile: { borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  pill: { borderRadius: 999, paddingHorizontal: 7, paddingVertical: 1 },
  pillText: { fontSize: 10, letterSpacing: 0.5 },
});
