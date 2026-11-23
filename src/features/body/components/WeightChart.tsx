import { useState } from 'react';
import { type LayoutChangeEvent, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';

import { addDays, type DateString, daysBetween } from '@/lib/dates';
import { fonts, Text, useTheme } from '@/ui';

import { dayMonth } from '@/features/today/lib/present';

import type { AvgPoint } from '../lib/weight';

const H = 220;
const PAD = { top: 16, right: 12, bottom: 24, left: 30 };

/**
 * Weight chart (Prog-Weight; dataviz skill): faint daily dots, bold 7-day
 * average line, dashed trend to the goal, dashed goal line labelled in place.
 * One y-axis (kg). Colours are validated theme steps for each mode. Tap a day
 * to read it.
 */
export function WeightChart({
  points,
  today,
  goal,
  trend,
}: {
  points: readonly AvgPoint[];
  today: DateString;
  goal: number;
  /** kg per day of the trend, to project forward (null = none). */
  trend: { perDay: number; from: number } | null;
}) {
  const { colors, scheme } = useTheme();
  const [width, setWidth] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  // Validated with the dataviz validator: dark #3B82F6 / #059669 on #131B2E; light #2563EB / #047857 on #FFFFFF.
  const series = scheme === 'dark' ? colors.accents.primary.light : colors.buttonPrimary;
  const goalColor =
    scheme === 'dark' ? colors.accents.success.gradient[0] : colors.accents.success.base;

  if (points.length === 0) return <View onLayout={onLayout} />;
  const first = points[0]!.date;
  const lastDate = points.at(-1)!.date;
  // Project the trend up to 8 weeks past the last point (or until the goal).
  const ahead =
    trend && trend.perDay < 0 ? Math.min(56, Math.ceil((goal - trend.from) / trend.perDay)) : 0;
  const end = addDays(lastDate > today ? lastDate : today, Math.max(ahead, 0));
  const span = Math.max(daysBetween(first, end), 1);
  const ys = [
    ...points.map((p) => p.weight),
    goal,
    ...(ahead > 0 && trend ? [trend.from + trend.perDay * ahead] : []),
  ];
  const lo = Math.floor(Math.min(...ys) - 0.5);
  const hi = Math.ceil(Math.max(...ys) + 0.5);
  const step = hi - lo > 12 ? 5 : hi - lo > 4 ? 2 : 1;
  const grid: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) grid.push(v);
  const innerW = Math.max(width - PAD.left - PAD.right, 1);
  const innerH = H - PAD.top - PAD.bottom;
  const x = (d: DateString) => PAD.left + (daysBetween(first, d) / span) * innerW;
  const y = (v: number) => PAD.top + innerH - ((v - lo) / (hi - lo)) * innerH;
  const show = picked !== null ? points[picked] : points.at(-1);

  return (
    <View
      onLayout={onLayout}
      testID="weight-chart"
      accessible
      accessibilityLabel={`Weight chart, 7-day average ${points.at(-1)!.avg7} kg, goal ${goal} kg`}
    >
      {width > 0 ? (
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
            <Line
              x1={PAD.left}
              x2={width - PAD.right}
              y1={y(goal)}
              y2={y(goal)}
              stroke={goalColor}
              strokeWidth={1.5}
              strokeDasharray="6 4"
            />
            <SvgText
              x={width - PAD.right}
              y={y(goal) - 5}
              fontSize={11}
              fill={colors.text}
              textAnchor="end"
              fontFamily={fonts.body[600]}
            >
              {`Goal ${goal} kg`}
            </SvgText>
            {points.map((p) => (
              <Circle
                key={p.date}
                cx={x(p.date)}
                cy={y(p.weight)}
                r={3}
                fill={series}
                opacity={0.35}
              />
            ))}
            {points
              .filter((p) => p.salty)
              .map((p) => (
                <Circle
                  key={`s${p.date}`}
                  cx={x(p.date)}
                  cy={y(p.weight)}
                  r={5}
                  fill="none"
                  stroke={colors.textSecondary}
                  strokeWidth={1.5}
                />
              ))}
            {points.length > 1 ? (
              <Polyline
                points={points.map((p) => `${x(p.date)},${y(p.avg7)}`).join(' ')}
                fill="none"
                stroke={series}
                strokeWidth={2.5}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ) : null}
            {ahead > 0 && trend ? (
              <Line
                x1={x(lastDate)}
                y1={y(trend.from)}
                x2={x(addDays(lastDate, ahead))}
                y2={y(trend.from + trend.perDay * ahead)}
                stroke={series}
                strokeWidth={2}
                strokeDasharray="2 4"
                strokeLinecap="round"
              />
            ) : null}
            {show ? (
              <Circle
                cx={x(show.date)}
                cy={y(show.avg7)}
                r={4}
                fill={series}
                stroke={colors.raised}
                strokeWidth={2}
              />
            ) : null}
            {show ? (
              <SvgText
                x={x(show.date)}
                y={y(show.avg7) - 9}
                fontSize={12}
                fill={colors.text}
                textAnchor="middle"
                fontFamily={fonts.body[700]}
              >
                {show.avg7.toFixed(1)}
              </SvgText>
            ) : null}
            {[first, end].map((d, i) => (
              <SvgText
                key={d}
                x={x(d)}
                y={H - 6}
                fontSize={11}
                fill={colors.textSecondary}
                textAnchor={i === 0 ? 'start' : 'end'}
                fontFamily={fonts.body[400]}
              >
                {dayMonth(d)}
              </SvgText>
            ))}
          </Svg>
          {points.map((p, i) => (
            <Pressable
              key={`h${p.date}`}
              accessibilityRole="button"
              accessibilityLabel={`${dayMonth(p.date)}: ${p.weight} kg, 7-day average ${p.avg7}${p.salty ? ', after a salty dinner' : ''}`}
              onPress={() => setPicked(i === picked ? null : i)}
              style={[styles.hit, { left: x(p.date) - 12, top: y(p.weight) - 22 }]}
            />
          ))}
        </View>
      ) : null}
      <View style={styles.legend}>
        <View style={[styles.dot, { backgroundColor: series, opacity: 0.35 }]} />
        <Text variant="caption" tone="secondary">
          Daily
        </Text>
        <View style={[styles.line, { backgroundColor: series }]} />
        <Text variant="caption" tone="secondary">
          7-day avg
        </Text>
        <Text variant="caption" tone="secondary">
          ··· Trend
        </Text>
        <Text variant="caption" tone="secondary">
          - - Goal
        </Text>
      </View>
      {picked !== null && show ? (
        <Text variant="caption" tone="secondary" testID="weight-tooltip">
          {`${dayMonth(show.date)}: ${show.weight} kg · 7-day avg ${show.avg7}${show.salty ? ' · salty dinner' : ''}`}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  hit: { position: 'absolute', width: 24, height: 44 },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  line: { width: 14, height: 3, borderRadius: 2 },
});
