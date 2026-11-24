import { act, fireEvent, screen, within } from '@testing-library/react-native';

import { renderWithStore } from '@/test/profileFixtures';
import { moneyStore } from '@/test/moneyFixtures';

import { IntegrationsScreen } from '../components/IntegrationsScreen';
import { ParserLabScreen, SAMPLES } from '../components/ParserLabScreen';
import { isTokenShaped, sha256Hex } from '../lib/ingest';

const mockRouter = { push: jest.fn(), back: jest.fn(), replace: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));
const mockInvoke = jest.fn();
jest.mock('@/lib/supabase', () => ({
  ...jest.requireActual('@/lib/supabase'),
  getSupabase: () => ({ functions: { invoke: mockInvoke } }),
}));

beforeEach(() => jest.clearAllMocks());

type Store = Awaited<ReturnType<typeof moneyStore>>['store'];
const queued = (store: Store, table: string) =>
  store
    .getState()
    .sync.queue.filter((m) => m.table === table)
    .map((m) => ({ op: m.op, client_id: m.client_id, row: m.row }));
const press = async (name: string | RegExp) => {
  await act(async () => {
    await fireEvent.press(screen.getByRole('button', { name }));
  });
};

describe('Integrations (F19)', () => {
  it('AC4: a new token is shown once and stored only as a SHA-256 hash; revoke', async () => {
    const { store, at } = await moneyStore([], {
      tokens: [{ name: 'Old Mac', last4: 'Zz99', last_used_at: '2026-11-20T00:00:00Z' }],
      inbox: [SAMPLES[0]],
    });
    await renderWithStore(store, <IntegrationsScreen now={at('12:00')} />);
    expect(screen.getByLabelText('Parser Lab. 1 SMS in inbox, 0 skipped')).toBeOnTheScreen();
    await press('Create token');
    await press('Create the token');
    const fresh = screen.getByTestId('fresh-token');
    const token = within(fresh).getByText(/^lifeos_pat_/).props.children as string;
    expect(isTokenShaped(token)).toBe(true);
    const [row] = queued(store, 'api_token');
    expect(row?.row).toEqual({
      name: 'iPhone Shortcuts',
      token_hash: await sha256Hex(token),
      last4: token.slice(-4),
    });
    expect(JSON.stringify(store.getState())).not.toContain(token);
    expect(screen.getByText(`iPhone Shortcuts …${token.slice(-4)}`)).toBeOnTheScreen();
    expect(screen.getByText('Syncing…')).toBeOnTheScreen();

    await press('Revoke Old Mac');
    expect(queued(store, 'api_token').at(-1)).toMatchObject({
      client_id: 'tok0',
      row: { revoked_at: expect.any(String) },
    });
    expect(screen.queryByRole('button', { name: 'Revoke Old Mac' })).toBeNull();
  });

  it('setup guides show the real function URLs', async () => {
    const { store, at } = await moneyStore();
    await renderWithStore(store, <IntegrationsScreen now={at('12:00')} />);
    await press(/^iPhone Shortcuts · SMS automation/);
    expect(screen.getByText(/\/functions\/v1\/ingest-sms$/)).toBeOnTheScreen();
    expect(screen.queryByText(/api\.lifeos\.app/)).toBeNull();
    await press(/^Siri/);
    expect(screen.getByText(/\/functions\/v1\/quick-log\/water$/)).toBeOnTheScreen();
  });
});

describe('Parser Lab', () => {
  it('dry run on the samples: stages and fields, writes nothing', async () => {
    const { store, at } = await moneyStore([], { inbox: [SAMPLES[0], SAMPLES[2]] });
    await renderWithStore(store, <ParserLabScreen now={at('12:00')} />);
    expect(screen.getByText('in inbox · 1 look like payments')).toBeOnTheScreen();
    await press('Sample: UPI debit');
    const r = screen.getByTestId('dry-result');
    expect(within(r).getByText('Would save')).toBeOnTheScreen();
    expect(within(r).getByLabelText('Extract: rule upi_debit')).toBeOnTheScreen();
    expect(within(r).getByLabelText('Categorise: Food & groceries')).toBeOnTheScreen();
    expect(within(r).getByLabelText('Amount: ₹40.00')).toBeOnTheScreen();
    expect(within(r).getByLabelText('Payee: HOT N SPICY')).toBeOnTheScreen();
    await press('Sample: Bill reminder');
    expect(within(screen.getByTestId('dry-result')).getByText('Would skip')).toBeOnTheScreen();
    expect(
      screen.getByLabelText('Reject rules: matched bill_reminder_auto_debit'),
    ).toBeOnTheScreen();
    await act(async () => {
      fireEvent.changeText(screen.getByLabelText('SMS to test'), 'hello there');
    });
    await press('Test, don’t save');
    expect(within(screen.getByTestId('dry-result')).getByText('Unmatched')).toBeOnTheScreen();
    expect(store.getState().sync.queue).toHaveLength(0);
  });

  it('dedupe stage spots an SMS already logged', async () => {
    const { store, at } = await moneyStore([
      [1, 40, 'food', 'HOT N SPICY', { txn_ref: '651870302957', source: 'sms' }],
    ]);
    await renderWithStore(store, <ParserLabScreen now={at('12:00')} />);
    await press('Sample: UPI debit');
    expect(within(screen.getByTestId('dry-result')).getByText('Duplicate')).toBeOnTheScreen();
  });

  it('process now calls the function; mark a skipped SMS as an expense', async () => {
    mockInvoke.mockResolvedValue({
      data: { processed: 2, expenses: 1, duplicates: 0, skipped: 1, leftInInbox: 0 },
      error: null,
    });
    const { store, at, today } = await moneyStore([], {
      skipped: [['INR 1,299.00 spent on card XX5678 at DECATHLON SPORTS', 'unmatched']],
    });
    await renderWithStore(store, <ParserLabScreen now={at('12:00')} />);
    await press('Process the inbox now');
    expect(mockInvoke).toHaveBeenCalledWith('ingest-sms', { body: { process: true } });
    expect(screen.getByText('2 processed · 1 saved · 1 skipped')).toBeOnTheScreen();

    await press(/^Mark as expense: INR 1,299/);
    expect(screen.getByTestId('amount')).toHaveTextContent('₹1,299');
    await press('Category Shopping');
    await press('Save ₹1,299, Shopping');
    expect(queued(store, 'expense')[0]?.row).toMatchObject({
      date: today,
      amount_inr: 1299,
      category_id: 'shopping',
      source: 'sms',
      raw_sms: 'INR 1,299.00 spent on card XX5678 at DECATHLON SPORTS',
    });
    expect(queued(store, 'expense_skipped')).toEqual([
      { op: 'upsert', client_id: 'sk0', row: { overridden: true } },
    ]);
    expect(screen.getByText(/^Nothing skipped/)).toBeOnTheScreen();
  });

  it('offline: process now says so', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: new Error('offline') });
    const { store, at } = await moneyStore();
    await renderWithStore(store, <ParserLabScreen now={at('12:00')} />);
    await press('Process the inbox now');
    expect(screen.getByText('Could not reach LifeOS. Try again when online.')).toBeOnTheScreen();
  });
});

describe('Widget setup (F22)', () => {
  it('copies the Scriptable script with the real widget-summary URL', async () => {
    const { setStringAsync } = jest.requireMock('expo-clipboard') as { setStringAsync: jest.Mock };
    const { store, at } = await moneyStore();
    await renderWithStore(store, <IntegrationsScreen now={at('12:00')} />);
    await press(/^Home-screen widget \(Scriptable\)/);
    await press('Copy widget script');
    const copied = setStringAsync.mock.calls.at(-1)?.[0] as string;
    expect(copied).toMatch(/const SUMMARY_URL = 'https:\/\/[^']+\/functions\/v1\/widget-summary';/);
    expect(copied).not.toContain('lifeos_pat_A');
    expect(screen.getByText('Widget script copied')).toBeOnTheScreen();
  });
});
