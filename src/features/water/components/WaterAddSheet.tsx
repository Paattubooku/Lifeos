import { AlertTriangle } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { formatClock, formatIndianNumber } from '@/lib/format';
import { Banner, PressableScale, Sheet, Text, useTheme } from '@/ui';

import { showBehind } from '../lib/copy';
import type { Pace } from '../lib/pace';
import { CustomAmount } from './CustomAmount';

export type WaterAddSheetProps = {
  visible: boolean;
  onClose: () => void;
  totalMl: number;
  targetMl: number;
  pace: Pace;
  nowClock: string;
  onAdd: (ml: number) => void;
};

/** Sheet-WaterAdd design (FAB long-press): 500 / 750 tiles, custom amount, pace line. */
export function WaterAddSheet(p: WaterAddSheetProps) {
  const { colors } = useTheme();
  const tile = (ml: number, sub: string) => (
    <PressableScale
      key={ml}
      accessibilityLabel={`Add ${ml} ml, ${sub}`}
      onPress={() => p.onAdd(ml)}
      style={[styles.tile, { backgroundColor: colors.raised, borderColor: colors.hairline }]}
    >
      <Text variant="metric" tone="water" num>
        {String(ml)}
      </Text>
      <Text variant="caption" tone="secondary">{`ml · ${sub}`}</Text>
    </PressableScale>
  );
  return (
    <Sheet
      visible={p.visible}
      onClose={p.onClose}
      title="Add water"
      testID="water-sheet"
      accessory={
        <Text variant="sub" weight={700} num>
          {formatIndianNumber(p.totalMl)}
          <Text
            variant="sub"
            tone="secondary"
            num
          >{` / ${formatIndianNumber(p.targetMl)} ml`}</Text>
        </Text>
      }
    >
      {showBehind(p.pace) ? (
        <Banner
          tone="danger"
          icon={AlertTriangle}
          title={`${formatIndianNumber(p.pace.gap)} ml behind pace`}
          body={`Pace for ${formatClock(p.nowClock)} is ${formatIndianNumber(p.pace.expected)} ml.`}
        />
      ) : null}
      <View style={styles.tiles}>
        {tile(500, 'bottle')}
        {tile(750, 'large')}
      </View>
      <Text variant="sub" weight={600}>
        Custom · 50 ml steps
      </Text>
      <CustomAmount
        initial={showBehind(p.pace) ? p.pace.suggested : 350}
        onAdd={p.onAdd}
        addLabel={(ml) => `Add ${ml} ml`}
        fullWidthAdd
      />
      <Text variant="caption" tone="secondary" align="center">
        Tap the water button for +200 ml. Hold for this sheet.
      </Text>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  tiles: { flexDirection: 'row', gap: 10 },
  tile: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 18,
    borderRadius: 16,
    borderWidth: 1,
    gap: 2,
  },
});
