import { useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { newClientId } from '@/lib/ids';
import { formatClock } from '@/lib/format';
import { useAppDispatch } from '@/store';
import {
  Button,
  Chip,
  NumberStepper,
  SegmentedToggle,
  Sheet,
  Text,
  TextField,
  TimePicker,
  Toggle,
  useSnackbar,
} from '@/ui';

import {
  type BlockDraft,
  type BlockLike,
  draftFromBlock,
  KIND_GROUPS,
  kindGroup,
  MEAL_SLOTS,
  type MealSlot,
  newBlockDraft,
  validateBlock,
  withKind,
  blocksOf,
} from '../lib/blocks';
import { planBlockDelete, planBlockRestore, planBlockSave } from '../lib/changes';
import { applyChanges } from '../slice';
import { KIND_ICON } from './KindIcon';

export type BlockEditSheetProps = {
  visible: boolean;
  onClose: () => void;
  templateId: string;
  /** null = add a new block. */
  block: BlockLike | null;
  blocks: readonly BlockLike[];
};

/**
 * Edit / add a block (Routine-BlockEdit design). Mount it with a `key` per
 * block so the form starts from that block's values.
 */
export function BlockEditSheet({
  visible,
  onClose,
  templateId,
  block,
  blocks,
}: BlockEditSheetProps) {
  const dispatch = useAppDispatch();
  const showSnackbar = useSnackbar();
  const { height } = useWindowDimensions();
  const [draft, setDraft] = useState<BlockDraft>(() =>
    block ? draftFromBlock(block) : newBlockDraft(blocksOf(blocks, templateId)),
  );
  const [busy, setBusy] = useState(false);

  const update = (patch: Partial<BlockDraft>) => setDraft((d) => ({ ...d, ...patch }));
  const error = validateBlock(draft);
  const changes = planBlockSave(block, draft, { templateId, blocks, newId: 'pending' });
  const unchanged = block !== null && changes.length === 0;

  const save = async () => {
    setBusy(true);
    const planned = block
      ? changes
      : planBlockSave(null, draft, { templateId, blocks, newId: newClientId() });
    await dispatch(applyChanges(planned));
    setBusy(false);
    showSnackbar({ message: block ? 'Block saved' : 'Block added' });
    onClose();
  };

  const remove = async () => {
    if (!block) return;
    await dispatch(applyChanges(planBlockDelete(block)));
    showSnackbar({
      message: `${block.title} deleted`,
      actionLabel: 'Undo',
      onAction: () => void dispatch(applyChanges(planBlockRestore(block))),
    });
    onClose();
  };

  const group = kindGroup(draft.kind);

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={block ? 'Edit block' : 'New block'}
      testID="block-sheet"
      accessory={
        block ? (
          <Button
            variant="destructive"
            size="sm"
            label="Delete"
            accessibilityLabel={`Delete ${block.title}`}
            onPress={() => void remove()}
          />
        ) : null
      }
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        style={{ maxHeight: height * 0.62 }}
        contentContainerStyle={styles.content}
      >
        <TextField
          label="Title"
          value={draft.title}
          onChangeText={(title) => update({ title })}
          maxLength={80}
          placeholder="e.g. Lunch"
          returnKeyType="done"
        />

        <View style={styles.section}>
          <Text variant="sub" weight={600}>
            Kind
          </Text>
          <View style={styles.chips}>
            {KIND_GROUPS.map((k) => (
              <Chip
                key={k.value}
                label={k.label}
                leadingIcon={KIND_ICON[k.value]}
                selected={group === k.value}
                accessibilityLabel={`Kind ${k.label}`}
                onPress={() => setDraft((d) => withKind(d, k.value))}
              />
            ))}
          </View>
        </View>

        <View style={styles.columns}>
          <View style={styles.column}>
            <Text variant="sub" weight={600}>
              Start
            </Text>
            <TimePicker
              value={draft.start_time}
              onChange={(start_time) => update({ start_time })}
              accessibilityLabel="Start"
              minuteStep={5}
            />
          </View>
          <View style={styles.column}>
            <Text variant="sub" weight={600}>
              Duration
            </Text>
            <NumberStepper
              value={draft.duration_min}
              onChange={(duration_min) => update({ duration_min })}
              accessibilityLabel="Duration"
              step={5}
              min={0}
              max={600}
              unit="min"
            />
            {draft.kind === 'meal' ? (
              <>
                <Text variant="sub" weight={600}>
                  Meal slot
                </Text>
                <SegmentedToggle<MealSlot>
                  accessibilityLabel="Meal slot"
                  options={MEAL_SLOTS.map((s) => ({ value: s.value, label: s.label }))}
                  value={draft.ref_slot ?? 'breakfast'}
                  onChange={(ref_slot) => update({ ref_slot })}
                />
              </>
            ) : null}
          </View>
        </View>

        <Toggle
          label="Notify at start"
          hint={`Reminder at ${formatClock(draft.start_time)}.`}
          value={draft.notify}
          onChange={(notify) => update({ notify })}
          testID="toggle-notify"
        />
        <Toggle
          label="Optional"
          hint="Shown on Today, never counted in the score."
          value={draft.is_optional}
          onChange={(is_optional) => update({ is_optional })}
          testID="toggle-optional"
        />
        {error && draft.title.length > 0 ? (
          <Text variant="caption" tone="danger">
            {error}
          </Text>
        ) : null}
      </ScrollView>
      <Button
        label={busy ? 'Saving…' : block ? 'Save block' : 'Add block'}
        accessibilityLabel={block ? 'Save block' : 'Add block'}
        onPress={() => void save()}
        disabled={busy || error !== null || unchanged}
        fullWidth
        size="lg"
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  content: { gap: 16, paddingBottom: 8 },
  section: { gap: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  columns: { flexDirection: 'row', gap: 12 },
  column: { flex: 1, gap: 8 },
});
