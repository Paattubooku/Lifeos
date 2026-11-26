import { setStringAsync } from 'expo-clipboard';
import { useRouter } from 'expo-router';
import {
  ChevronDown,
  ChevronUp,
  Copy,
  FlaskConical,
  KeyRound,
  MessageSquare,
  Mic,
  Plus,
  Wallet,
  LayoutGrid,
} from 'lucide-react-native';
import { type ReactNode, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { useNow } from '@/features/today/hooks/useNow';
import { shortDay } from '@/features/today/lib/present';
import { supabaseConfig } from '@/lib/config';
import {
  Button,
  Card,
  Screen,
  Sheet,
  StatusChip,
  Text,
  TextField,
  useSnackbar,
  useTheme,
} from '@/ui';

import { widgetScript } from '@/features/widgets/lib/script';

import { useIntegrations } from '../hooks/useIntegrations';
import { ago } from '../lib/tokens';

export const MONO = Platform.select({ ios: 'Menlo', default: 'monospace' });

const PROJECT_URL = supabaseConfig?.url ?? 'https://<project-ref>.supabase.co';
export const ENDPOINTS = {
  sms: `${PROJECT_URL}/functions/v1/ingest-sms`,
  water: `${PROJECT_URL}/functions/v1/quick-log/water`,
  expense: `${PROJECT_URL}/functions/v1/quick-log/expense`,
  widget: `${PROJECT_URL}/functions/v1/widget-summary`,
};

function Guide({
  icon: Icon,
  title,
  steps,
}: {
  icon: typeof Mic;
  title: string;
  steps: ReactNode[];
}) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <Card padding={16} gap={10}>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${title}. ${open ? 'Hide' : 'Show'} steps`}
        style={styles.row}
      >
        <View style={[styles.icon, { backgroundColor: colors.accents.primary.tint }]}>
          <Icon size={18} color={colors.accents.primary.base} strokeWidth={2} />
        </View>
        <Text variant="body" weight={700} style={styles.flex}>
          {title}
        </Text>
        {open ? (
          <ChevronUp size={18} color={colors.textSecondary} />
        ) : (
          <ChevronDown size={18} color={colors.textSecondary} />
        )}
      </Pressable>
      {open
        ? steps.map((s, i) => (
            <View key={i} style={styles.step}>
              <Text variant="sub" weight={700} style={styles.num}>
                {String(i + 1)}
              </Text>
              <View style={styles.flex}>
                {typeof s === 'string' ? <Text variant="sub">{s}</Text> : s}
              </View>
            </View>
          ))
        : null}
    </Card>
  );
}

function CopyLine({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  const showSnackbar = useSnackbar();
  return (
    <Pressable
      onPress={() =>
        void setStringAsync(value).then(() => showSnackbar({ message: `${label} copied` }))
      }
      accessibilityRole="button"
      accessibilityLabel={`Copy ${label}`}
      style={[styles.copy, { backgroundColor: colors.recessed }]}
    >
      <Text variant="caption" style={styles.mono} selectable>
        {value}
      </Text>
      <Copy size={16} color={colors.accents.primary.base} />
    </Pressable>
  );
}

/** Settings → Integrations (Integrations design, PRD F19): tokens, Parser Lab, setup guides. */
export function IntegrationsScreen({ now: fixedNow }: { now?: number } = {}) {
  const ticking = useNow(60_000);
  const now = fixedNow ?? ticking;
  const router = useRouter();
  const { colors } = useTheme();
  const showSnackbar = useSnackbar();
  const g = useIntegrations();
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('iPhone Shortcuts');
  const [fresh, setFresh] = useState<{ name: string; token: string } | null>(null);

  const create = async () => {
    setNaming(false);
    const token = await g.createToken(name);
    setFresh({ name: name.trim(), token });
  };
  const active = g.tokens.filter((t) => !t.revoked_at);

  return (
    <Screen
      title="Integrations"
      subtitle="Tokens, SMS parsing, shortcuts"
      withTabBar={false}
      back={{ label: 'More', onPress: () => router.back() }}
    >
      <Card
        onPress={() => router.push('/settings/parser-lab')}
        accessibilityLabel={`Parser Lab. ${g.inbox.length} SMS in inbox, ${g.skipped.length} skipped`}
        padding={14}
      >
        <View style={styles.row}>
          <View style={[styles.icon, { backgroundColor: colors.accents.primary.tint }]}>
            <FlaskConical size={18} color={colors.accents.primary.base} strokeWidth={2} />
          </View>
          <View style={styles.flex}>
            <Text variant="body" weight={700}>
              Parser Lab
            </Text>
            <Text variant="caption" tone="secondary">
              {`${g.inbox.length} SMS in inbox · ${g.skipped.length} skipped`}
            </Text>
          </View>
          <StatusChip label={String(g.inbox.length)} tone="neutral" />
        </View>
      </Card>

      <View style={styles.row}>
        <Text variant="kicker" tone="secondary" style={styles.flex}>
          API tokens
        </Text>
        <Button
          icon={Plus}
          size="sm"
          label="Create token"
          accessibilityLabel="Create token"
          onPress={() => setNaming(true)}
        />
      </View>

      {fresh ? (
        <Card
          padding={16}
          gap={8}
          testID="fresh-token"
          style={{ borderColor: colors.accents.primary.base }}
        >
          <View style={styles.row}>
            <KeyRound size={16} color={colors.accents.primary.base} />
            <Text variant="body" weight={700} style={styles.flex}>
              {`New token: ${fresh.name}`}
            </Text>
            <StatusChip label="Shown once" tone="danger" />
          </View>
          <CopyLine label="Token" value={fresh.token} />
          <Text variant="caption" tone="secondary">
            {`Copy it now. After you leave this screen only the last 4 characters (…${fresh.token.slice(-4)}) are kept. It works once Life has synced.`}
          </Text>
        </Card>
      ) : null}

      <Card padding={14} gap={0} testID="tokens">
        {g.tokens.length === 0 ? (
          <Text variant="sub" tone="secondary">
            No tokens yet. Create one for iPhone Shortcuts.
          </Text>
        ) : (
          g.tokens.map((t, i) => (
            <View
              key={t.client_id}
              style={[
                styles.tokenRow,
                i > 0 ? { borderTopWidth: 1, borderColor: colors.hairline } : null,
              ]}
            >
              <KeyRound
                size={18}
                color={t.revoked_at ? colors.textSecondary : colors.accents.primary.base}
              />
              <View style={styles.flex}>
                <Text variant="body" weight={600} tone={t.revoked_at ? 'secondary' : 'default'}>
                  {`${t.name} …${t.last4}`}
                </Text>
                <Text variant="caption" tone="secondary">
                  {t.revoked_at
                    ? `Revoked ${shortDay(t.revoked_at.slice(0, 10))}`
                    : g.pendingTokens.has(t.client_id)
                      ? 'Syncing…'
                      : `Created ${t.created_at ? shortDay(t.created_at.slice(0, 10)) : ''} · ${t.last_used_at ? `used ${ago(t.last_used_at, now)}` : 'never used'}`}
                </Text>
              </View>
              {t.revoked_at ? null : (
                <Button
                  size="sm"
                  variant="destructive"
                  label="Revoke"
                  accessibilityLabel={`Revoke ${t.name}`}
                  onPress={() => g.revoke(t)}
                />
              )}
            </View>
          ))
        )}
      </Card>

      <Text variant="kicker" tone="secondary">
        Setup guides
      </Text>
      <Guide
        icon={MessageSquare}
        title="iPhone Shortcuts · SMS automation"
        steps={[
          'Shortcuts → Automation → New Automation → Message. Sender: your bank. The parser reads ICICI Bank messages today. Choose Run Immediately.',
          <View key="u" style={styles.gap}>
            <Text variant="sub">Add the action Get Contents of URL, method POST, URL:</Text>
            <CopyLine label="SMS URL" value={ENDPOINTS.sms} />
          </View>,
          'Headers: Authorization = Bearer + your token. Request Body: JSON, key "text" = Shortcut Input → Content.',
          'Send yourself a test SMS (or use Parser Lab → samples), then check Money → Transactions.',
        ]}
      />
      <Guide
        icon={Mic}
        title="Siri · “Log 500 ml”"
        steps={[
          <View key="u" style={styles.gap}>
            <Text variant="sub">Shortcuts → New Shortcut → Get Contents of URL, method POST:</Text>
            <CopyLine label="Water URL" value={ENDPOINTS.water} />
          </View>,
          'Headers: Authorization = Bearer + your token. Request Body: JSON, key "ml" (Number) = 500.',
          'Name it Log 500 ml. Say “Hey Siri, log 500 ml”, or add it to the Action button or Back Tap.',
        ]}
      />
      <Guide
        icon={Wallet}
        title="Shortcut · quick expense"
        steps={[
          'New Shortcut → Ask for Input (Number, “Amount”).',
          <View key="u" style={styles.gap}>
            <Text variant="sub">Get Contents of URL, method POST:</Text>
            <CopyLine label="Expense URL" value={ENDPOINTS.expense} />
          </View>,
          'Headers: Authorization = Bearer + your token. JSON: "amount" = Provided Input, "category" = food (optional "payee", "note").',
        ]}
      />
      <Guide
        icon={LayoutGrid}
        title="Home-screen widget (Scriptable)"
        steps={[
          'Install Scriptable (free) from the App Store.',
          <View key="c" style={styles.gap}>
            <Text variant="sub">
              Copy the Life widget script (your URL is already in it; no token inside):
            </Text>
            <Button
              icon={Copy}
              size="sm"
              variant="secondary"
              label="Copy widget script"
              accessibilityLabel="Copy widget script"
              onPress={() =>
                void setStringAsync(widgetScript(PROJECT_URL)).then(() =>
                  showSnackbar({ message: 'Widget script copied' }),
                )
              }
            />
          </View>,
          'Scriptable → + → paste → name it Life. Run it once → Set token → paste your token (it stays in the iPhone Keychain).',
          'Long-press the home screen → + → Scriptable → pick a size → Edit widget → Script: Life. Parameter (optional): score, water, spend or next.',
          'It refreshes about every 15 minutes and shows the time it was updated. A revoked token shows “Reconnect in Life”.',
        ]}
      />
      <Text variant="caption" tone="secondary">
        {`${active.length} active ${active.length === 1 ? 'token' : 'tokens'}. Tokens are stored only as a SHA-256 hash; a revoked token stops working at once.`}
      </Text>

      {naming ? (
        <Sheet visible onClose={() => setNaming(false)} title="Create token" testID="token-sheet">
          <View style={styles.gap}>
            <TextField
              label="Name"
              value={name}
              onChangeText={setName}
              maxLength={60}
              placeholder="iPhone Shortcuts"
            />
            <Button
              icon={KeyRound}
              label="Create"
              accessibilityLabel="Create the token"
              fullWidth
              disabled={!name.trim()}
              onPress={() =>
                void create().catch(() => showSnackbar({ message: 'Could not create a token' }))
              }
            />
          </View>
        </Sheet>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  flex: { flex: 1 },
  icon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  tokenRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  step: { flexDirection: 'row', gap: 10 },
  num: { width: 18 },
  gap: { gap: 8 },
  copy: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 10 },
  mono: { flex: 1, fontFamily: MONO },
});
