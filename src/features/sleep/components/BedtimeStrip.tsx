import { useState } from 'react';
import { type LayoutChangeEvent, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Text as SvgText } from 'react-native-svg';

import { formatClock } from '@/lib/format';
import { fonts, Text, useTheme } from '@/ui';

export type BedDot = { offset: number; detail: string; clock: string };

const H = 64;
const PAD = 14;
/** 21:30 → 23:30 as minutes after 18:00; later or earlier dots sit on the edge. */
const FROM = 210;
const TO = 330;
const TICKS = [210, 240, 270, 300, 330];
const tickLabel = (m: number) =>
  formatClock(
    `${String(18 + Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`,
  ).replace(' pm', '');

/** Bedtimes on one line (dataviz: single series, 8 px ringed dots, target line). */
export function BedtimeStrip({ dots, target }: { dots: readonly BedDot[]; target: number }) {
  const { colors, scheme } = useTheme();
  const [width, setWidth] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const series = scheme === 'dark' ? colors.accents.primary.light : colors.buttonPrimary;
  const innerW = Math.max(width - PAD * 2, 1);
  const x = (m: number) => PAD + ((Math.min(Math.max(m, FROM), TO) - FROM) / (TO - FROM)) * innerW;
  const cy = 22;
  const p = picked === null ? null : dots[picked];
  return (
    <View
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
      accessible
      accessibilityLabel={`Bedtimes of ${dots.length} nights between 9:30 and 11:30 pm`}
      testID="bedtime-strip"
    >
      {width > 0 ? (
        <View>
          <Svg width={width} height={H}>
            <Line
              x1={PAD}
              x2={width - PAD}
              y1={cy}
              y2={cy}
              stroke={colors.hairline}
              strokeWidth={1}
            />
            <Line
              x1={x(target)}
              x2={x(target)}
              y1={cy - 14}
              y2={cy + 14}
              stroke={colors.textSecondary}
              strokeWidth={1}
              strokeDasharray="3 3"
            />
            {dots.map((d, i) => (
              <Circle
                key={i}
                cx={x(d.offset)}
                cy={cy}
                r={4}
                fill={series}
                stroke={colors.raised}
                strokeWidth={2}
                opacity={picked === null || picked === i ? 0.85 : 0.35}
              />
            ))}
            {TICKS.map((m, i) => (
              <SvgText
                key={m}
                x={x(m)}
                y={H - 6}
                fontSize={11}
                fill={colors.textSecondary}
                textAnchor={i === 0 ? 'start' : i === TICKS.length - 1 ? 'end' : 'middle'}
                fontFamily={fonts.body[400]}
              >
                {i === TICKS.length - 1 ? `${tickLabel(m)} pm` : tickLabel(m)}
              </SvgText>
            ))}
          </Svg>
          {dots.map((d, i) => (
            <Pressable
              key={`hit${i}`}
              accessibilityRole="button"
              accessibilityLabel={`${d.detail}: bed ${formatClock(d.clock)}`}
              onPress={() => setPicked(i === picked ? null : i)}
              style={[styles.hit, { left: x(d.offset) - 12 }]}
            />
          ))}
          {p ? (
            <Text
              variant="caption"
              tone="secondary"
            >{`${p.detail}: bed ${formatClock(p.clock)}`}</Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({ hit: { position: 'absolute', top: 0, width: 24, height: 44 } });
