import { useState } from 'react';
import { type LayoutChangeEvent, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Line, Path, Rect, Text as SvgText } from 'react-native-svg';

import { fonts, Text, useTheme } from '@/ui';

import { TARGET_HOURS } from '../lib/sleep';

export type SleepBar = { label: string; hours: number | null; detail: string };

const H = 180;
const PAD = { top: 14, right: 8, bottom: 22, left: 24 };
const MAX = 9;
const GRID = [0, 3, 6, 9];

/** Bar with a 4 px rounded top anchored to the baseline. */
function barPath(x: number, y: number, w: number, base: number) {
  const r = Math.min(4, w / 2, base - y);
  return `M${x},${base} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${base} Z`;
}

/**
 * Hours slept, one bar per night (dataviz skill: single series, thin bars with
 * a 2 px gap, recessive grid, one axis, 7–8 h target band labelled directly,
 * tap a bar for its value). Missing nights show a dash on the baseline.
 */
export function SleepBars({ bars }: { bars: readonly SleepBar[] }) {
  const { colors, scheme } = useTheme();
  const [width, setWidth] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  const series = scheme === 'dark' ? colors.accents.primary.light : colors.buttonPrimary;
  const band = scheme === 'dark' ? colors.accents.success.gradient[0] : colors.accents.success.base;
  const innerW = Math.max(width - PAD.left - PAD.right, 1);
  const innerH = H - PAD.top - PAD.bottom;
  const slot = innerW / Math.max(bars.length, 1);
  const barW = Math.max(Math.min(slot - 2, 16), 2);
  const x = (i: number) => PAD.left + i * slot + (slot - barW) / 2;
  const y = (h: number) => PAD.top + innerH - (Math.min(h, MAX) / MAX) * innerH;
  const base = y(0);
  const p = picked === null ? null : bars[picked];

  return (
    <View
      onLayout={onLayout}
      accessible
      accessibilityLabel={`Hours slept, last ${bars.length} nights, target ${TARGET_HOURS} to 8 hours`}
      testID="sleep-bars"
    >
      {width > 0 ? (
        <View>
          <Svg width={width} height={H}>
            <Rect
              x={PAD.left}
              y={y(8)}
              width={innerW}
              height={y(TARGET_HOURS) - y(8)}
              fill={band}
              opacity={0.16}
            />
            <SvgText
              x={width - PAD.right - 4}
              y={y(8) - 4}
              fontSize={11}
              fill={colors.textSecondary}
              textAnchor="end"
              fontFamily={fonts.body[600]}
            >
              7–8 h target
            </SvgText>
            {GRID.map((g) => (
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
            {GRID.map((g) => (
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
            {bars.map((b, i) =>
              b.hours === null ? (
                <Line
                  key={`b${i}`}
                  x1={x(i)}
                  x2={x(i) + barW}
                  y1={base - 1}
                  y2={base - 1}
                  stroke={colors.textSecondary}
                  strokeWidth={2}
                  strokeLinecap="round"
                />
              ) : (
                <Path
                  key={`b${i}`}
                  d={barPath(x(i), y(b.hours), barW, base)}
                  fill={series}
                  opacity={picked === null || picked === i ? 1 : 0.45}
                />
              ),
            )}
            {bars.map((b, i) =>
              i % 2 === 0 || i === bars.length - 1 ? (
                <SvgText
                  key={`x${i}`}
                  x={x(i) + barW / 2}
                  y={H - 6}
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
              accessibilityLabel={`${b.detail}: ${b.hours === null ? 'not logged' : `${b.hours} hours`}`}
              onPress={() => setPicked(i === picked ? null : i)}
              style={[
                styles.hit,
                { left: PAD.left + i * slot, width: slot, height: H - PAD.bottom },
              ]}
            />
          ))}
          {p ? (
            <Text variant="caption" tone="secondary" testID="sleep-tooltip">
              {`${p.detail}: ${p.hours === null ? 'not logged' : `${p.hours} h`}`}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({ hit: { position: 'absolute', top: 0 } });
