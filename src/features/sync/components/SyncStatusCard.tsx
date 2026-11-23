import { RefreshCw } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Text, useTheme, withAlpha } from '@/ui';

import { formatSyncedAgo, type SyncSummary } from '../selectors';

export type SyncStatusCardProps = {
  summary: SyncSummary;
  onSync: () => void;
  onRetry: () => void;
  /** Injectable clock for tests. */
  now?: () => number;
};

/** More-Menu design: "Synced 2 min ago · 0 pending" + Sync; danger variant for a sync issue. */
export function SyncStatusCard({ summary, onSync, onRetry, now = Date.now }: SyncStatusCardProps) {
  const { colors } = useTheme();
  const [tick, setTick] = useState(now());
  useEffect(() => {
    const t = setInterval(() => setTick(now()), 30_000);
    return () => clearInterval(t);
  }, [now]);

  const { status, pending, dead, lastSyncedAt, lastError } = summary;
  const tone =
    status === 'issue'
      ? colors.accents.danger
      : status === 'offline'
        ? colors.accents.calories
        : status === 'synced'
          ? colors.accents.success
          : colors.accents.primary;

  const headline =
    status === 'issue'
      ? 'Sync issue'
      : status === 'offline'
        ? 'Offline'
        : status === 'syncing'
          ? 'Syncing…'
          : lastSyncedAt
            ? `Synced ${formatSyncedAgo(lastSyncedAt, Math.max(tick, now()))}`
            : 'Not synced yet';
  const detail = status === 'issue' ? `${dead} failed · ${pending} pending` : `${pending} pending`;
  const hint =
    status === 'issue'
      ? (lastError ?? 'Some changes were rejected by the server.')
      : status === 'offline' && pending > 0
        ? 'Saved on this phone. Syncs when you’re back online.'
        : null;

  return (
    <View
      testID="sync-status"
      accessible={false}
      style={[
        styles.card,
        { backgroundColor: withAlpha(tone.base, 0.08), borderColor: withAlpha(tone.base, 0.3) },
      ]}
    >
      <View style={[styles.dot, { backgroundColor: tone.base }]} />
      <View
        style={styles.copy}
        accessible
        accessibilityRole={status === 'issue' ? 'alert' : undefined}
        accessibilityLabel={[headline, detail, hint].filter(Boolean).join('. ')}
      >
        <Text variant="sub" num>
          <Text variant="sub" weight={700}>
            {headline}
          </Text>
          <Text variant="sub" tone="secondary">
            {` · ${detail}`}
          </Text>
        </Text>
        {hint ? (
          <Text variant="caption" tone="secondary" numberOfLines={2}>
            {hint}
          </Text>
        ) : null}
      </View>
      {status === 'issue' ? (
        <Button
          size="sm"
          variant="ghost"
          icon={RefreshCw}
          label="Retry"
          accessibilityLabel={`Retry ${dead} failed change${dead === 1 ? '' : 's'}`}
          onPress={onRetry}
        />
      ) : (
        <Button
          size="sm"
          variant="ghost"
          icon={RefreshCw}
          label="Sync"
          accessibilityLabel="Sync now"
          disabled={status === 'syncing'}
          onPress={onSync}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  copy: { flex: 1, minWidth: 0, gap: 2 },
});
