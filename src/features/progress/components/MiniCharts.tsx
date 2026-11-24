import { useState } from 'react';
import { type LayoutChangeEvent, View } from 'react-native';
import Svg, { Circle, Line, Path, Polyline, Rect } from 'react-native-svg';

import type { HeatBand } from '@/features/today/lib/streak';
import { type Palette, useTheme, withAlpha } from '@/ui';

const W = 132;

/** Bar with a rounded top anchored to the baseline (dataviz mark spec). */
function bar(x: number, y: number, w: number, base: number) {
  const r = Math.min(3, w / 2, Math.max(base - y, 0));
  return `M${x},${base} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${base} Z`;
}

/**
 * Glanceable bars (one series per card): optional dashed target line; bars
 * that miss `dimBelow` are drawn faint. Missing values leave a gap.
 */
export function MiniBars({
  values,
  color,
  target,
  dimBelow,
  height = 48,
  testID,
}: {
  values: readonly (number | null)[];
  color: string;
  target?: number;
  dimBelow?: number;
  height?: number;
  testID?: string;
}) {
  const { colors } = useTheme();
  const max = Math.max(target ?? 0, ...values.map((v) => v ?? 0), 1) * 1.08;
  const slot = W / values.length;
  const bw = Math.max(slot - 2, 2);
  const y = (v: number) => height - (v / max) * height;
  return (
    <View testID={testID} importantForAccessibility="no-hide-descendants">
      <Svg width={W} height={height}>
        {values.map((v, i) =>
          v === null || v <= 0 ? null : (
            <Path
              key={i}
              d={bar(i * slot + 1, y(v), bw, height)}
              fill={color}
              opacity={dimBelow !== undefined && v < dimBelow ? 0.4 : 1}
            />
          ),
        )}
        {target !== undefined ? (
          <Line
            x1={0}
            x2={W}
            y1={y(target)}
            y2={y(target)}
            stroke={colors.textSecondary}
            strokeWidth={1}
            strokeDasharray="3 3"
          />
        ) : null}
      </Svg>
    </View>
  );
}

/** Weight trend sparkline: 2 px line, the latest point marked. */
export function MiniLine({
  values,
  color,
  height = 48,
}: {
  values: readonly number[];
  color: string;
  height?: number;
}) {
  const { colors } = useTheme();
  const [w, setW] = useState(W);
  if (values.length < 2) return null;
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || 1;
  const x = (i: number) => 5 + (i / (values.length - 1)) * (w - 10);
  const y = (v: number) => 5 + (1 - (v - lo) / span) * (height - 10);
  const last = values.length - 1;
  return (
    <View
      style={{ width: W }}
      onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)}
      importantForAccessibility="no-hide-descendants"
      testID="mini-line"
    >
      <Svg width={w} height={height}>
        <Polyline
          points={values.map((v, i) => `${x(i)},${y(v)}`).join(' ')}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <Circle
          cx={x(last)}
          cy={y(values[last]!)}
          r={4}
          fill={color}
          stroke={colors.raised}
          strokeWidth={2}
        />
      </Svg>
    </View>
  );
}

/** Same bands as the Streaks heatmap (F06). */
export function heatColor(band: HeatBand, colors: Palette): string {
  const p = colors.accents.primary.base;
  switch (band) {
    case 'lt50':
      return colors.accents.danger.base;
    case '50to69':
      return colors.accents.calories.base;
    case '70to79':
      return withAlpha(p, 0.25);
    case '80to89':
      return withAlpha(p, 0.5);
    case '90plus':
      return colors.buttonPrimary;
    default:
      return colors.hairline;
  }
}

/** 30 days, 3 rows of 10, oldest top-left; coloured by the day's score. */
export function MiniHeat({ cells }: { cells: readonly { date: string; band: HeatBand }[] }) {
  const { colors } = useTheme();
  const cell = 11;
  const gap = 2;
  const cols = 10;
  return (
    <View importantForAccessibility="no-hide-descendants" testID="mini-heat">
      <Svg width={cols * (cell + gap)} height={Math.ceil(cells.length / cols) * (cell + gap)}>
        {cells.map((c, i) => (
          <Rect
            key={c.date}
            testID={`heat-${c.date}-${c.band}`}
            x={(i % cols) * (cell + gap)}
            y={Math.floor(i / cols) * (cell + gap)}
            width={cell}
            height={cell}
            rx={3}
            fill={heatColor(c.band, colors)}
          />
        ))}
      </Svg>
    </View>
  );
}
