import { AlertCircle, Check, ChevronDown, ChevronUp, Minus } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Card, Text, useTheme } from '@/ui';

import { type RowContext, rowText, rowTitle, timeParts } from '../lib/present';
import type { DayRow } from '../selectors';

export type TimelineProps = {
  rows: readonly DayRow[];
  ctx: RowContext;
  nextId: string | null;
  templateName: string | null;
  onTap: (row: DayRow) => void;
  onLongPress: (row: DayRow) => void;
};

/** Leading finished rows fold into "6 done · Wake → Lunch" once there are 3+. */
export function foldCount(rows: readonly Pick<DayRow, 'state'>[]): number {
  let n = 0;
  while (n < rows.length && (rows[n]!.state === 'done' || rows[n]!.state === 'skipped')) n++;
  return n >= 3 && n < rows.length ? n : 0;
}

export function Timeline({ rows, ctx, nextId, templateName, onTap, onLongPress }: TimelineProps) {
  const [expanded, setExpanded] = useState(false);
  const fold = expanded ? 0 : foldCount(rows);
  const folded = rows.slice(0, foldCount(rows));
  const shown = rows.slice(fold);

  return (
    <Card padding={14} gap={6} testID="timeline">
      <View style={styles.header}>
        <Text variant="heading" accessibilityRole="header">
          Timeline
        </Text>
        <Text variant="caption" tone="secondary">
          {`${rows.length} blocks${templateName ? ` · ${templateName}` : ''}`}
        </Text>
      </View>
      {folded.length > 0 ? (
        <FoldRow
          count={folded.length}
          from={rowTitle(folded[0]!, ctx.session)}
          to={rowTitle(folded[folded.length - 1]!, ctx.session)}
          expanded={expanded}
          onPress={() => setExpanded((e) => !e)}
        />
      ) : null}
      {shown.map((row, i) => (
        <TimelineRow
          key={row.block.client_id}
          row={row}
          ctx={ctx}
          isNext={row.block.client_id === nextId}
          last={i === shown.length - 1}
          onTap={onTap}
          onLongPress={onLongPress}
        />
      ))}
    </Card>
  );
}

function FoldRow(p: {
  count: number;
  from: string;
  to: string;
  expanded: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const Icon = p.expanded ? ChevronUp : ChevronDown;
  return (
    <Pressable
      onPress={p.onPress}
      accessibilityRole="button"
      accessibilityLabel={`${p.count} done, ${p.from} to ${p.to}. ${p.expanded ? 'Hide' : 'Show'}`}
      style={[styles.fold, { backgroundColor: colors.recessed }]}
    >
      <View
        style={[
          styles.dot,
          {
            backgroundColor: colors.accents.success.base,
            borderColor: colors.accents.success.base,
          },
        ]}
      >
        <Check size={14} color={colors.onButton} strokeWidth={3} />
      </View>
      <Text variant="body" weight={700}>
        {`${p.count} done`}
      </Text>
      <Text variant="sub" tone="secondary" style={styles.flex} numberOfLines={1}>
        {`· ${p.from} → ${p.to}`}
      </Text>
      <Icon size={18} color={colors.textSecondary} strokeWidth={2} />
    </Pressable>
  );
}

function TimelineRow(props: {
  row: DayRow;
  ctx: RowContext;
  isNext: boolean;
  last: boolean;
  onTap: (row: DayRow) => void;
  onLongPress: (row: DayRow) => void;
}) {
  const { colors } = useTheme();
  const { row, ctx, isNext, last } = props;
  const text = rowText(row, ctx, isNext);
  const { time, period } = timeParts(row.block.start_time);
  const muted = row.state === 'skipped' || row.block.is_optional;
  const current = row.state === 'current';
  const success = colors.accents.success.base;
  const primary = colors.accents.primary.base;
  const danger = colors.accents.danger.base;

  const dot = (() => {
    switch (row.state) {
      case 'done':
        return (
          <View style={[styles.dot, { backgroundColor: success, borderColor: success }]}>
            <Check size={14} color={colors.onButton} strokeWidth={3} />
          </View>
        );
      case 'current':
        return (
          <View style={[styles.dot, { backgroundColor: primary, borderColor: primary }]}>
            <View style={[styles.inner, { backgroundColor: colors.onButton }]} />
          </View>
        );
      case 'overdue':
        return (
          <View style={[styles.dot, { borderColor: danger }]}>
            <AlertCircle size={14} color={danger} strokeWidth={2.4} />
          </View>
        );
      case 'skipped':
        return (
          <View style={[styles.dot, styles.dashed, { borderColor: colors.border }]}>
            <Minus size={12} color={colors.textSecondary} strokeWidth={2.4} />
          </View>
        );
      default:
        return <View style={[styles.dot, { borderColor: colors.border }]} />;
    }
  })();

  const status =
    row.state === 'done'
      ? 'done'
      : row.state === 'skipped'
        ? 'skipped'
        : row.state === 'overdue'
          ? 'overdue'
          : current
            ? 'now'
            : isNext
              ? 'next'
              : row.state === 'due'
                ? 'due'
                : 'upcoming';

  return (
    <View style={styles.row}>
      <View style={styles.timeCol}>
        <Text variant="sub" weight={700} num align="right">
          {time}
        </Text>
        <Text variant="caption" tone="secondary" align="right">
          {period}
        </Text>
      </View>
      <View style={styles.rail}>
        {dot}
        {last ? null : (
          <View
            style={[
              styles.line,
              { backgroundColor: row.state === 'done' ? success : colors.hairline },
            ]}
          />
        )}
      </View>
      <Pressable
        testID={`row-${row.block.client_id}`}
        onPress={() => props.onTap(row)}
        onLongPress={() => props.onLongPress(row)}
        delayLongPress={350}
        accessibilityRole="button"
        accessibilityLabel={`${time} ${period.toLowerCase()}, ${text.title}, ${status}. ${text.sub}`}
        accessibilityHint={
          row.state === 'done'
            ? 'Tap to undo. Long press to skip.'
            : 'Tap to mark done. Long press to skip.'
        }
        style={[
          styles.content,
          current
            ? {
                borderColor: primary,
                borderWidth: 1.5,
                backgroundColor: colors.accents.primary.tint,
              }
            : null,
        ]}
      >
        <View style={styles.flex}>
          <Text
            variant="body"
            weight={700}
            tone={muted ? 'secondary' : 'default'}
            strike={row.state === 'skipped'}
          >
            {text.title}
          </Text>
          <Text variant="caption" tone={text.late ? 'danger' : 'secondary'} numberOfLines={2}>
            {text.sub}
          </Text>
        </View>
        {text.pill ? (
          <View
            style={[
              styles.pill,
              {
                backgroundColor:
                  text.pill === 'now' ? colors.accents.primary.tint : colors.recessed,
              },
            ]}
          >
            <Text variant="caption" weight={700} tone={text.pill === 'now' ? 'primary' : 'default'}>
              {text.pill === 'now' ? 'NOW' : 'Next'}
            </Text>
          </View>
        ) : null}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  fold: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    minHeight: 44,
  },
  row: { flexDirection: 'row', alignItems: 'stretch', gap: 10, minHeight: 60 },
  timeCol: { width: 48, paddingTop: 10 },
  rail: { width: 24, alignItems: 'center', paddingTop: 10 },
  dot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dashed: { borderStyle: 'dashed' },
  inner: { width: 8, height: 8, borderRadius: 4 },
  line: { width: 2, flex: 1, marginTop: 2 },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'transparent',
    minHeight: 52,
  },
  flex: { flex: 1, minWidth: 0, gap: 2 },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
});
