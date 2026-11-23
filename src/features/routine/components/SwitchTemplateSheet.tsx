import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { istMinutesOfDay } from '@/lib/dates';
import { useAppDispatch } from '@/store';
import { Button, SegmentedToggle, Sheet, StatusChip, Text, useSnackbar, useTheme } from '@/ui';

import { useRoutine } from '../hooks/useRoutine';
import { type BlockLike, blocksOf, blocksSummary, dayMinutes } from '../lib/blocks';
import { planSwitch, type SwitchScope, type TemplateRowLike } from '../lib/changes';
import { activeTemplates } from '../lib/templates';
import { applyChanges } from '../slice';

const SCOPES = [
  { value: 'today', label: 'Today only' },
  { value: 'always', label: 'From now on' },
] as const;

/** Blocks of `templateId` still ahead of `now` today. */
export function blocksLeft(blocks: readonly BlockLike[], templateId: string, now: number) {
  const m = istMinutesOfDay(now);
  const nowMin = m < 180 ? m + 1440 : m;
  return blocksOf(blocks, templateId).filter((b) => dayMinutes(b.start_time) > nowMin).length;
}

export type SwitchTemplateSheetProps = {
  visible: boolean;
  onClose: () => void;
  now?: () => number;
};

/** "Switch template" (Sheet-SwitchTemplate design): today only, or from now on. */
export function SwitchTemplateSheet({
  visible,
  onClose,
  now = Date.now,
}: SwitchTemplateSheetProps) {
  const dispatch = useAppDispatch();
  const showSnackbar = useSnackbar();
  const { colors } = useTheme();
  const { today, templates, blocks, todayDayLog, todayPlan } = useRoutine();
  const options = activeTemplates(templates);
  const currentId = todayPlan.template?.id ?? null;
  const [picked, setPicked] = useState<string | null>(
    () => options.find((t) => t.id !== currentId)?.id ?? null,
  );
  const [scope, setScope] = useState<SwitchScope>('today');
  const target = options.find((t) => t.id === picked) ?? null;
  const left = target ? blocksLeft(blocks, target.id, now()) : 0;

  const doSwitch = async () => {
    if (!target) return;
    await dispatch(
      applyChanges(
        planSwitch(target as TemplateRowLike, scope, {
          today,
          todayDayLog: todayDayLog ?? null,
          templates: templates as TemplateRowLike[],
          now: now(),
        }),
      ),
    );
    showSnackbar({
      message: scope === 'today' ? `Today runs ${target.name}` : `${target.name} from now on`,
    });
    onClose();
  };

  const noop = !target || (target.id === currentId && scope === 'today');

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Switch template"
      subtitle="Today only. Done blocks stay done."
      testID="switch-sheet"
    >
      <View accessibilityRole="radiogroup" accessibilityLabel="Templates" style={styles.list}>
        {options.map((t) => {
          const selected = t.id === picked;
          return (
            <Pressable
              key={t.id}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={`${t.name}${t.id === currentId ? ', current' : ''}`}
              onPress={() => setPicked(t.id)}
              style={[
                styles.option,
                {
                  borderColor: selected ? colors.accents.primary.base : colors.hairline,
                  backgroundColor: colors.raised,
                },
              ]}
            >
              <View
                style={[
                  styles.radio,
                  { borderColor: selected ? colors.accents.primary.base : colors.border },
                ]}
              >
                {selected ? (
                  <View style={[styles.dot, { backgroundColor: colors.accents.primary.base }]} />
                ) : null}
              </View>
              <View style={styles.flex}>
                <View style={styles.nameRow}>
                  <Text variant="body" weight={700}>
                    {t.name}
                  </Text>
                  {t.id === currentId ? <StatusChip label="Current" tone="neutral" /> : null}
                </View>
                <Text variant="caption" tone="secondary" num>
                  {blocksSummary(blocksOf(blocks, t.id))}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
      <SegmentedToggle
        accessibilityLabel="Applies to"
        options={SCOPES}
        value={scope}
        onChange={setScope}
      />
      <Text variant="sub" tone="secondary">
        {scope === 'today'
          ? `Switching now: ${left} block${left === 1 ? '' : 's'} left today change. Score resets to the new plan.`
          : `Today and every ${weekdayName(today)} from now on run ${target?.name ?? 'this template'}.`}
      </Text>
      <Button
        label={target ? `Switch to ${target.name}` : 'Switch'}
        accessibilityLabel={target ? `Switch to ${target.name}` : 'Switch'}
        onPress={() => void doSwitch()}
        disabled={noop}
        fullWidth
        size="lg"
      />
      <Button
        variant="secondary"
        label="Cancel"
        accessibilityLabel="Cancel"
        onPress={onClose}
        fullWidth
      />
    </Sheet>
  );
}

function weekdayName(date: string): string {
  const names = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const d = new Date(`${date}T00:00:00Z`).getUTCDay();
  return names[(d + 6) % 7] as string;
}

const styles = StyleSheet.create({
  list: { gap: 10 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    minHeight: 44,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  flex: { flex: 1, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
