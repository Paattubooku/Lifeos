import { useRouter } from 'expo-router';
import { ChevronRight, Plus, Repeat } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { weekStart } from '@/lib/dates';
import { newClientId } from '@/lib/ids';
import { useAppDispatch } from '@/store';
import { type Accent, Banner, Button, Card, Screen, StatusChip, Text, useTheme } from '@/ui';

import { useRoutine } from '../hooks/useRoutine';
import { blocksOf, blocksSummary } from '../lib/blocks';
import { planNewTemplate, planRestore, type TemplateRowLike } from '../lib/changes';
import {
  activeTemplates,
  conflictText,
  stripLetters,
  WEEKDAY_LETTER,
  weekdayConflicts,
  weekdaysText,
  weekStrip,
} from '../lib/templates';
import { applyChanges } from '../slice';
import { SwitchTemplateSheet } from './SwitchTemplateSheet';

const STRIP_ACCENTS: Accent[] = ['primary', 'protein', 'water', 'calories', 'success'];

/** Routine-Templates design: week strip, template cards, switch for today. */
export function RoutineScreen() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { colors } = useTheme();
  const { today, templates, blocks, todayPlan, isLoading } = useRoutine();
  const [switching, setSwitching] = useState(false);

  const list = activeTemplates(templates as TemplateRowLike[]);
  const archived = (templates as TemplateRowLike[]).filter((t) => t.archived_at);
  const strip = weekStrip(list, weekStart(today));
  const conflicts = weekdayConflicts(list);
  const accentOf = (id: string) =>
    STRIP_ACCENTS[
      Math.max(
        0,
        list.findIndex((t) => t.id === id),
      ) % STRIP_ACCENTS.length
    ] as Accent;
  const manual = list.filter((t) => t.weekdays.length === 0);
  const onStrip = list.filter((t) => strip.some((s) => s?.id === t.id));
  const letters = stripLetters(onStrip);
  const letter = (id: string) => letters.get(id) ?? '?';

  const create = async () => {
    const id = newClientId();
    await dispatch(applyChanges(planNewTemplate(templates as TemplateRowLike[], id, Date.now())));
    router.push({ pathname: '/routine/[id]', params: { id } });
  };

  const back = { label: 'More', onPress: () => router.back() };
  const action = (
    <Button
      label="New"
      icon={Plus}
      size="sm"
      accessibilityLabel="New template"
      onPress={() => void create()}
    />
  );

  if (isLoading && list.length === 0) {
    return (
      <Screen title="Routine" withTabBar={false} back={back}>
        <ActivityIndicator color={colors.accents.primary.base} accessibilityLabel="Loading" />
      </Screen>
    );
  }

  return (
    <Screen
      title="Routine"
      subtitle="Templates run your Today timeline"
      withTabBar={false}
      back={back}
      action={action}
    >
      <Card kicker="Week">
        <View style={styles.week}>
          {strip.map((t, i) => (
            <View
              key={i}
              style={styles.day}
              accessible
              accessibilityLabel={`${['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][i]}: ${t?.name ?? 'no template'}`}
            >
              <Text variant="caption" tone="secondary" weight={600}>
                {WEEKDAY_LETTER[i]}
              </Text>
              <View
                style={[
                  styles.cell,
                  {
                    backgroundColor: t ? colors.accents[accentOf(t.id)].tint : colors.recessed,
                  },
                ]}
              >
                <Text variant="sub" weight={700} tone={t ? accentOf(t.id) : 'secondary'}>
                  {t ? letter(t.id) : '–'}
                </Text>
              </View>
            </View>
          ))}
        </View>
        <Text variant="caption" tone="secondary">
          {[
            onStrip.map((t) => `${letter(t.id)} = ${t.name}`).join(' · '),
            manual.length > 0
              ? `${manual.map((t) => t.name).join(', ')} ${manual.length === 1 ? 'is' : 'are'} applied by hand from Today`
              : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </Text>
      </Card>

      {conflicts.map((c) => (
        <Banner
          key={c.weekday}
          tone="warning"
          title={conflictText(c)}
          testID={`conflict-${c.weekday}`}
        />
      ))}

      <Button
        variant="secondary"
        icon={Repeat}
        label={`Switch today’s template${todayPlan.template ? ` (${todayPlan.template.name})` : ''}`}
        accessibilityLabel="Switch template for today"
        onPress={() => setSwitching(true)}
      />

      {list.map((t) => {
        const active = todayPlan.template?.id === t.id;
        return (
          <Card
            key={t.id}
            onPress={() => router.push({ pathname: '/routine/[id]', params: { id: t.id } })}
            accessibilityLabel={`${t.name}${active ? ', active today' : ''}. ${weekdaysText(t.weekdays)}, ${blocksSummary(blocksOf(blocks, t.id))}`}
            style={active ? { borderColor: colors.accents.primary.base } : undefined}
          >
            <View style={styles.row}>
              <View style={styles.flex}>
                <View style={styles.nameRow}>
                  <Text variant="heading">{t.name}</Text>
                  {active ? <StatusChip label="Active today" tone="primary" beacon /> : null}
                </View>
                <Text variant="sub" tone="secondary" num>
                  {`${weekdaysText(t.weekdays)} · ${blocksSummary(blocksOf(blocks, t.id))}`}
                </Text>
              </View>
              <ChevronRight size={18} color={colors.textSecondary} strokeWidth={2} />
            </View>
          </Card>
        );
      })}

      {archived.length > 0 ? (
        <Card kicker="Archived">
          {archived.map((t) => (
            <View key={t.id} style={styles.row}>
              <View style={styles.flex}>
                <Text variant="body" weight={600}>
                  {t.name}
                </Text>
                <Text variant="caption" tone="secondary">
                  Kept for past days · {blocksSummary(blocksOf(blocks, t.id))}
                </Text>
              </View>
              <Button
                variant="ghost"
                size="sm"
                label="Restore"
                accessibilityLabel={`Restore ${t.name}`}
                onPress={() => void dispatch(applyChanges(planRestore(t, Date.now())))}
              />
            </View>
          ))}
        </Card>
      ) : null}

      {switching ? <SwitchTemplateSheet visible onClose={() => setSwitching(false)} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  week: { flexDirection: 'row', gap: 6 },
  day: { flex: 1, alignItems: 'center', gap: 6 },
  cell: {
    alignSelf: 'stretch',
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1, minWidth: 0, gap: 4 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
});
