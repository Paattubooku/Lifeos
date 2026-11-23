import { StyleSheet, View } from 'react-native';

import { formatIndianNumber } from '@/lib/format';
import { Card, StatusChip, type StatusTone, Text, useTheme } from '@/ui';

import { energyLine, energyZone, ZONE_LABEL } from '../lib/energy';

const BAR_MAX = 1300;
const TONE: Record<ReturnType<typeof energyZone>, StatusTone> = {
  small: 'calories',
  target: 'success',
  aggressive: 'danger',
  surplus: 'danger',
};

/** Prog-Energy design: today's deficit, its zone (300–700 on target), the fix, and where the numbers come from. */
export function EnergyCard({
  tdeeKcal,
  eaten,
  bmrKcal,
  weightForBmr,
  factor,
  measured,
}: {
  tdeeKcal: number;
  eaten: number;
  bmrKcal: number;
  weightForBmr: number;
  factor: number;
  measured: boolean;
}) {
  const { colors } = useTheme();
  const deficit = tdeeKcal - eaten;
  const zone = energyZone(deficit);
  const accent = colors.accents[TONE[zone] as 'calories' | 'success' | 'danger'];
  const pos = (v: number) => `${Math.min(Math.max(v / BAR_MAX, 0), 1) * 100}%` as const;
  return (
    <Card kicker="Energy · today" testID="energy-card">
      <View style={styles.chip}>
        <StatusChip label={ZONE_LABEL[zone].toUpperCase()} tone={TONE[zone]} />
      </View>
      <Text variant="metric" num style={{ color: accent.base }}>
        {formatIndianNumber(Math.abs(deficit))}
        <Text variant="sub" tone="secondary">
          {deficit >= 0 ? '  kcal deficit' : '  kcal surplus'}
        </Text>
      </Text>
      <View
        style={[styles.track, { backgroundColor: colors.recessed }]}
        accessible
        accessibilityLabel={`Deficit ${deficit} kcal, target 300 to 700`}
      >
        <View
          style={[
            styles.zone,
            { left: pos(300), width: pos(400), backgroundColor: colors.accents.success.tint },
          ]}
        />
        <View
          style={[
            styles.zone,
            { left: pos(1000), width: pos(300), backgroundColor: colors.accents.danger.tint },
          ]}
        />
        <View style={[styles.marker, { left: pos(deficit), backgroundColor: accent.base }]} />
      </View>
      <View style={styles.scale}>
        {[0, 300, 700, 1000, 1300].map((v) => (
          <Text key={v} variant="caption" tone="secondary" num>
            {v === 1300 ? '1,300 kcal' : formatIndianNumber(v)}
          </Text>
        ))}
      </View>
      <Text variant="body">{energyLine(deficit)}</Text>
      {[
        [`BMR (Mifflin, ${weightForBmr.toFixed(1)} kg)`, bmrKcal],
        [measured ? 'TDEE measured from the scale' : `TDEE estimate (× ${factor})`, tdeeKcal],
        ['Eaten today', eaten],
      ].map(([label, v]) => (
        <View key={String(label)} style={[styles.row, { borderTopColor: colors.hairline }]}>
          <Text variant="sub" tone="secondary">
            {String(label)}
          </Text>
          <Text variant="sub" weight={700} num>{`${formatIndianNumber(Number(v))} kcal`}</Text>
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  chip: { position: 'absolute', right: 16, top: 12 },
  track: { height: 10, borderRadius: 5, overflow: 'hidden' },
  zone: { position: 'absolute', top: 0, bottom: 0 },
  marker: { position: 'absolute', top: -2, width: 4, height: 14, borderRadius: 2, marginLeft: -2 },
  scale: { flexDirection: 'row', justifyContent: 'space-between' },
  row: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, paddingTop: 8 },
});
