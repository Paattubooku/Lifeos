import { act, fireEvent, screen, within } from '@testing-library/react-native';
import { shareAsync } from 'expo-sharing';

import { renderWithStore } from '@/test/profileFixtures';
import { moneyStore } from '@/test/moneyFixtures';

import { EXPORT_TABLES } from '../lib/exportData';
import { MoreScreen } from '../components/MoreScreen';
import { SettingsScreen } from '../components/SettingsScreen';

const mockRouter = { push: jest.fn(), back: jest.fn(), replace: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));
const mockFrom = jest.fn();
jest.mock('@/lib/supabase', () => ({
  ...jest.requireActual('@/lib/supabase'),
  getSupabase: () => ({ from: mockFrom }),
}));

beforeEach(() => jest.clearAllMocks());

const press = async (name: string | RegExp) => {
  await act(async () => {
    await fireEvent.press(screen.getByRole('button', { name }));
  });
};

/** Fake PostgREST: a few rows for some tables, empty for the rest; one page. */
function fakeTables(data: Record<string, unknown[]>) {
  mockFrom.mockImplementation((table: string) => ({
    select: () => ({
      range: async (from: number) => ({ data: from === 0 ? (data[table] ?? []) : [], error: null }),
    }),
  }));
}

describe('Settings (F23)', () => {
  it('targets rows open the profile editor; theme switch', async () => {
    const { store } = await moneyStore();
    await renderWithStore(store, <SettingsScreen />);
    const targets = screen.getByTestId('targets');
    expect(within(targets).getAllByRole('button').length).toBeGreaterThanOrEqual(8);
    await press(/^Water: .* ml\. Edit$/);
    expect(mockRouter.push).toHaveBeenCalledWith('/settings/profile');
    await act(async () => {
      fireEvent.press(screen.getByRole('radio', { name: 'Light' }));
    });
    expect(store.getState().app.themePreference).toBe('light');
  });

  it('AC: Export JSON writes valid JSON with every table and opens the share sheet', async () => {
    fakeTables({
      water_log: [{ date: '2026-11-24', amount_ml: 500 }],
      api_token: [{ name: 'iPhone', token_hash: 'h', last4: 'ab12' }],
    });
    const { store } = await moneyStore();
    await renderWithStore(store, <SettingsScreen />);
    await press('Export JSON');
    expect(mockFrom).toHaveBeenCalledTimes(EXPORT_TABLES.length);
    expect(shareAsync).toHaveBeenCalledWith(
      expect.stringMatching(/lifeos-\d{4}-\d{2}-\d{2}\.json$/),
      expect.objectContaining({ mimeType: 'application/json' }),
    );
    const { __files } = jest.requireMock('expo-file-system') as { __files: Map<string, string> };
    const json = [...__files.entries()].find(([k]) => k.endsWith('.json'))![1];
    const doc = JSON.parse(json) as {
      tables: Record<string, unknown[]>;
      counts: Record<string, number>;
    };
    expect(Object.keys(doc.tables).sort()).toEqual([...EXPORT_TABLES].sort());
    expect(doc.counts.water_log).toBe(1);
    expect(json).not.toContain('token_hash');
    expect(screen.getByText('Exported 2 rows')).toBeOnTheScreen();
  });

  it('Export CSV shares a zip; offline says so', async () => {
    fakeTables({});
    const { store } = await moneyStore();
    await renderWithStore(store, <SettingsScreen />);
    await press('Export CSV');
    expect(shareAsync).toHaveBeenCalledWith(
      expect.stringMatching(/-csv\.zip$/),
      expect.objectContaining({ mimeType: 'application/zip' }),
    );
    mockFrom.mockImplementation(() => ({
      select: () => ({ range: async () => ({ data: null, error: { message: 'offline' } }) }),
    }));
    await press('Export JSON');
    expect(screen.getByText('Export needs a connection. Try again when online.')).toBeOnTheScreen();
  });
});

describe('More (F23 design)', () => {
  it('grouped menu with live subtitles and links', async () => {
    const { store, at } = await moneyStore([[0, 220, 'food', 'Shop']]);
    await renderWithStore(store, <MoreScreen now={at('12:00')} />);
    expect(screen.getByLabelText(/^Money\. \w{3}: ₹220 of ₹18,000$/)).toBeOnTheScreen();
    for (const [label, path] of [
      [/^Tasks\./, '/tasks'],
      [/^Program\./, '/program'],
      [/^Integrations\. SMS parser · 0 in inbox · 0 tokens$/, '/settings/integrations'],
      [/^Settings\./, '/settings'],
    ] as const) {
      await act(async () => {
        fireEvent.press(screen.getByLabelText(label));
      });
      expect(mockRouter.push).toHaveBeenLastCalledWith(path);
    }
    expect(screen.getByText(/^LifeOS /)).toBeOnTheScreen();
  });
});
