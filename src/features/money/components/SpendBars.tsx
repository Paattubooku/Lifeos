import { useState } from 'react';
import { type LayoutChangeEvent, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Line, Path, Text as SvgText } from 'react-native-svg';

import { dayMonth, shortDay } from '@/features/today/lib/present';
import { formatInr } from '@/lib/format';
import { fonts, Text, useTheme } from '@/ui';

export type Bar = { label: string; value: number; detail: string };

function barPath(x: number, y: number, w: number, base: number) {
  const r = Math.min(4, w / 2, Math.max(base - y, 0));
  return `M${x},${base} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${base} Z`;
}

/**
 * Single-series spend bars (dataviz: 4 px rounded tops on the baseline, 2 px
 * gaps, recessive axis, the average as a labelled dashed line, tap a bar to
 * read it). `emphasis` bars are drawn full strength, the rest muted.
 */
export function Bars({
  bars,
  color,
  height = 130,
  average,
  valueLabels,
  emphasis,
  everyOtherLabel,
  accessibilityLabel,
  testID,
}: {
  bars: readonly Bar[];
  color: string;
  height?: number;
  average?: { value: number; label: string } | null;
  valueLabels?: boolean;
  emphasis?: (i: number) => boolean;
  everyOtherLabel?: boolean;
  accessibilityLabel: string;
  testID?: string;
}) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const top = valueLabels ? 18 : 8;
  const bottom = 20;
  const innerH = height - top - bottom;
  const max = Math.max(1, ...bars.map((b) => b.value), average?.value ?? 0);
  const slot = width / Math.max(bars.length, 1);
  const bw = Math.max(Math.min(slot - 2, 28), 2);
  const x = (i: number) => i * slot + (slot - bw) / 2;
  const y = (v: number) => top + innerH - (v / max) * innerH;
  const base = y(0);
  const p = picked === null ? null : bars[picked];

  return (
    <View
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
      accessible
      accessibilityLabel={accessibilityLabel}
      testID={testID}
    >
      {width > 0 ? (
        <View>
          <Svg width={width} height={height}>
            <Line x1={0} x2={width} y1={base} y2={base} stroke={colors.hairline} strokeWidth={1} />
            {bars.map((b, i) =>
              b.value > 0 ? (
                <Path
                  key={i}
                  d={barPath(x(i), y(b.value), bw, base)}
                  fill={color}
                  opacity={
                    picked !== null
                      ? picked === i
                        ? 1
                        : 0.35
                      : !emphasis || emphasis(i)
                        ? 1
                        : 0.55
                  }
                />
              ) : null,
            )}
            {average && average.value > 0 ? (
              <>
                <Line
                  x1={0}
                  x2={width}
                  y1={y(average.value)}
                  y2={y(average.value)}
                  stroke={colors.textSecondary}
                  strokeWidth={1}
                  strokeDasharray="4 3"
                />
                <SvgText
                  x={width - 2}
                  y={y(average.value) - 4}
                  fontSize={11}
                  fill={colors.textSecondary}
                  textAnchor="end"
                  fontFamily={fonts.body[400]}
                >
                  {average.label}
                </SvgText>
              </>
            ) : null}
            {valueLabels
              ? bars.map((b, i) => (
                  <SvgText
                    key={`v${i}`}
                    x={x(i) + bw / 2}
                    y={12}
                    fontSize={10}
                    fill={colors.textSecondary}
                    textAnchor="middle"
                    fontFamily={fonts.body[600]}
                  >
                    {formatInr(b.value)}
                  </SvgText>
                ))
              : null}
            {bars.map((b, i) =>
              !everyOtherLabel || (bars.length - 1 - i) % 2 === 0 ? (
                <SvgText
                  key={`x${i}`}
                  x={x(i) + bw / 2}
                  y={height - 5}
                  fontSize={11}
                  fill={colors.textSecondary}
                  textAnchor="middle"
                  fontFamily={fonts.body[400]}
                >
                  {b.label}
                </SvgText>
              ) : null,
            )}
          </Svg>
          {bars.map((b, i) => (
            <Pressable
              key={`hit${i}`}
              accessibilityRole="button"
              accessibilityLabel={`${b.detail}: ${formatInr(b.value)}`}
              onPress={() => setPicked(i === picked ? null : i)}
              style={[styles.hit, { left: i * slot, width: slot, height }]}
            />
          ))}
          {p ? (
            <Text variant="caption" tone="secondary" testID="bar-tooltip">
              {`${p.detail}: ${formatInr(p.value)}`}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/** Overview "Last 14 days": today's bar emphasised, average line. */
export function SpendBars({ bars }: { bars: readonly { date: string; total: number }[] }) {
  const { colors, scheme } = useTheme();
  const total = bars.reduce((s, b) => s + b.total, 0);
  const avg = bars.length ? Math.round(total / bars.length) : 0;
  return (
    <Bars
      bars={bars.map((b) => ({
        label: String(Number(b.date.slice(8))),
        value: b.total,
        detail: shortDay(b.date),
      }))}
      color={scheme === 'dark' ? colors.accents.primary.light : colors.buttonPrimary}
      average={{ value: avg, label: `avg ${formatInr(avg)}/day` }}
      emphasis={(i) => i === bars.length - 1}
      everyOtherLabel
      accessibilityLabel={`Spend per day, ${dayMonth(bars[0]?.date ?? '')} to ${dayMonth(bars.at(-1)?.date ?? '')}, average ${formatInr(avg)} a day`}
      testID="spend-bars"
    />
  );
}

const styles = StyleSheet.create({ hit: { position: 'absolute', top: 0 } });
