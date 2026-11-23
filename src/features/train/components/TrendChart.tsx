import { useState } from 'react';
import { type LayoutChangeEvent, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';

import { fonts, Text, useTheme } from '@/ui';

export type TrendPoint = { label: string; value: number; detail: string };

const H = 180;
const PAD = { top: 22, right: 28, bottom: 24, left: 30 };

/** Nice gridline values: 3–5 steps over [min, max]. */
export function ticks(min: number, max: number): number[] {
  if (!(max > min)) return [Math.floor(min)];
  const raw = (max - min) / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const out: number[] = [];
  let v = Math.floor(min / step) * step;
  // Until a tick reaches the top value, so no point sits above the plot.
  while (out.length === 0 || (out.at(-1) as number) < max) {
    out.push(Math.round(v * 10) / 10);
    v += step;
  }
  return out;
}

/**
 * Single-series line (dataviz skill): 2 px line, 8 px markers with a surface
 * ring, recessive gridlines, one axis, only the latest point labelled; tap a
 * point for its value. The sessions table below is the table view.
 */
export function TrendChart({
  points,
  unit,
  accessibilityLabel,
}: {
  points: readonly TrendPoint[];
  unit: string;
  accessibilityLabel: string;
}) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const values = points.map((p) => p.value);
  const grid = ticks(Math.min(...values), Math.max(...values));
  const lo = grid[0]!;
  const hi = grid.at(-1)! > lo ? grid.at(-1)! : lo + 1;
  const innerW = Math.max(width - PAD.left - PAD.right, 1);
  const innerH = H - PAD.top - PAD.bottom;
  const x = (i: number) =>
    PAD.left + (points.length <= 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const y = (v: number) => PAD.top + innerH - ((v - lo) / (hi - lo)) * innerH;
  const line = colors.accents.primary.base;
  const last = points.length - 1;
  const show = picked ?? last;

  return (
    <View
      onLayout={onLayout}
      accessible
      accessibilityLabel={accessibilityLabel}
      testID="trend-chart"
    >
      {width > 0 && points.length > 0 ? (
        <View>
          <Svg width={width} height={H}>
            {grid.map((g) => (
              <Line
                key={g}
                x1={PAD.left}
                x2={width - PAD.right}
                y1={y(g)}
                y2={y(g)}
                stroke={colors.hairline}
                strokeWidth={1}
              />
            ))}
            {grid.map((g) => (
              <SvgText
                key={`l${g}`}
                x={PAD.left - 6}
                y={y(g) + 4}
                fontSize={11}
                fill={colors.textSecondary}
                textAnchor="end"
                fontFamily={fonts.body[400]}
              >
                {String(g)}
              </SvgText>
            ))}
            {points.map((p, i) =>
              i === 0 || i === last || points.length <= 8 ? (
                <SvgText
                  key={`x${i}`}
                  x={x(i)}
                  y={H - 6}
                  fontSize={11}
                  fill={colors.textSecondary}
                  textAnchor="middle"
                  fontFamily={fonts.body[400]}
                >
                  {p.label}
                </SvgText>
              ) : null,
            )}
            {points.length > 1 ? (
              <Polyline
                points={points.map((p, i) => `${x(i)},${y(p.value)}`).join(' ')}
                fill="none"
                stroke={line}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ) : null}
            {points.map((p, i) => (
              <Circle
                key={`c${i}`}
                cx={x(i)}
                cy={y(p.value)}
                r={4}
                fill={i === show ? line : colors.raised}
                stroke={line}
                strokeWidth={2}
              />
            ))}
            <SvgText
              x={Math.min(x(show), width - PAD.right)}
              y={y(points[show]!.value) - 10}
              fontSize={12}
              fill={colors.text}
              textAnchor={show === last ? 'end' : 'middle'}
              fontFamily={fonts.body[700]}
            >
              {`${points[show]!.value} ${unit}`}
            </SvgText>
          </Svg>
          {points.map((p, i) => (
            <Pressable
              key={`hit${i}`}
              accessibilityRole="button"
              accessibilityLabel={`${p.label}: ${p.value} ${unit}, ${p.detail}`}
              onPress={() => setPicked(i === picked ? null : i)}
              style={[styles.hit, { left: x(i) - 22, top: y(p.value) - 22 }]}
            />
          ))}
          {picked !== null ? (
            <Text variant="caption" tone="secondary" testID="trend-tooltip">
              {`${points[picked]!.label}: ${points[picked]!.value} ${unit} · ${points[picked]!.detail}`}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  hit: { position: 'absolute', width: 44, height: 44 },
});
