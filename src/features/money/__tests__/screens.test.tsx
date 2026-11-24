import { act, fireEvent, screen, within } from '@testing-library/react-native';

import { renderWithStore } from '@/test/profileFixtures';
import { type ExpenseSpec, moneyStore } from '@/test/moneyFixtures';

import { AnalyticsScreen } from '../components/AnalyticsScreen';
import { BudgetsScreen } from '../components/BudgetsScreen';
import { MoneyScreen } from '../components/MoneyScreen';
import { TransactionsScreen } from '../components/TransactionsScreen';

const mockRouter = { push: jest.fn(), back: jest.fn(), replace: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));

beforeEach(() => jest.clearAllMocks());

type Store = Awaited<ReturnType<typeof moneyStore>>['store'];
const queued = (store: Store, table = 'expense') =>
  store
    .getState()
    .sync.queue.filter((m) => m.table === table)
    .map((m) => ({ op: m.op, client_id: m.client_id, row: m.row }));
const press = async (name: string | RegExp, role: 'button' | 'radio' = 'button') => {
  await act(async () => {
    await fireEvent.press(screen.getByRole(role, { name }));
  });
};

const SPECS: ExpenseSpec[] = [
  [0, 220, 'food', 'Murugan Stores'],
  [0, 80, 'transport', 'Ola auto'],
  [1, 1240, 'food', 'BigBasket', { payment_method: 'card', source: 'sms' }],
  [1, 349, 'bills', 'Jio recharge'],
  [2, 900, 'transport', 'Rapido bike'],
  [3, 50000, 'income', 'Salary'],
];

describe('Money overview (F18)', () => {
  it('AC1: spend excludes credits; income separate; last 5; links', async () => {
    const { store, at } = await moneyStore(SPECS);
    await renderWithStore(store, <MoneyScreen now={at('12:00')} />);
    const month = screen.getByTestId('month-card');
    expect(within(month).getByText(/ of ₹18,000$/)).toBeOnTheScreen();
    expect(screen.getByLabelText('Today, ₹300, 2 payments')).toBeOnTheScreen();
    expect(screen.getByLabelText(/^Income, ₹(50,000|0), \w{3} so far$/)).toBeOnTheScreen();
    const last5 = within(screen.getByTestId('last5')).getAllByLabelText(/(spent|received) ₹/);
    expect(last5).toHaveLength(5);
    expect(screen.getByText(/Transport over by ₹180/)).toBeOnTheScreen();
    await press('All transactions');
    expect(mockRouter.push).toHaveBeenCalledWith('/money/transactions');
  });

  it('add an expense in three taps: amount → category → save', async () => {
    const { store, at, today } = await moneyStore();
    await renderWithStore(store, <MoneyScreen now={at('12:00')} />);
    expect(screen.getByText('No expenses yet')).toBeOnTheScreen();
    await press('Add expense');
    for (const k of ['2', '4', '0']) await press(k);
    expect(screen.getByTestId('amount')).toHaveTextContent('₹240');
    await press('Category Food & groceries');
    await press('Save ₹240, Food & groceries');
    expect(queued(store)).toEqual([
      {
        op: 'upsert',
        client_id: expect.any(String),
        row: {
          date: today,
          amount_inr: 240,
          direction: 'debit',
          category_id: 'food',
          payment_method: 'upi',
          merchant: null,
          note: null,
          is_recurring: false,
          source: 'manual',
        },
      },
    ]);
    expect(screen.getByLabelText('Today, ₹240, 1 payment')).toBeOnTheScreen();
  });

  it('income goes in as a credit', async () => {
    const { store, at } = await moneyStore();
    await renderWithStore(store, <MoneyScreen now={at('12:00')} />);
    await press('Add expense');
    for (const k of ['5', '0', '0', 'Decimal point', '5']) await press(k);
    await press('Category Income');
    await press('Save ₹500.50, Income');
    expect(queued(store)[0]?.row).toMatchObject({ direction: 'credit', amount_inr: 500.5 });
    expect(screen.getByLabelText('Today, ₹0, 0 payments')).toBeOnTheScreen();
  });
});

describe('Transactions', () => {
  it('filters, search, day groups, paging, swipe delete with undo', async () => {
    const many: ExpenseSpec[] = Array.from({ length: 20 }, (_, i) => [
      i % 5,
      10 + i,
      'food',
      `Shop ${i}`,
    ]);
    const { store, at } = await moneyStore([...SPECS, ...many]);
    await renderWithStore(store, <TransactionsScreen now={at('12:00')} />);
    const rows = () =>
      within(screen.getByTestId('transactions')).queryAllByLabelText(/(spent|received) ₹/);
    expect(rows()).toHaveLength(15);
    await press('Show more transactions, 11 left');
    expect(rows()).toHaveLength(26);

    await press('Received', 'radio');
    expect(rows().map((r) => r.props.accessibilityLabel)).toEqual([
      expect.stringMatching(/^Salary, received ₹50,000/),
    ]);
    await press('All', 'radio');
    await press('Only Transport');
    expect(rows()).toHaveLength(2);
    await press('All categories');
    await act(async () => {
      fireEvent.changeText(screen.getByLabelText('Search'), 'jio');
    });
    expect(rows()).toHaveLength(1);
    await press('Delete Jio recharge');
    expect(queued(store).at(-1)).toMatchObject({ op: 'soft_delete', client_id: 'ex3' });
    expect(rows()).toHaveLength(0);
    expect(screen.getByText('Nothing matches')).toBeOnTheScreen();
    await press(/^Undo/);
    expect(rows()).toHaveLength(1);
  });

  it('AC3: opens pre-filtered by category', async () => {
    const { store, at } = await moneyStore(SPECS);
    await renderWithStore(store, <TransactionsScreen now={at('12:00')} category="transport" />);
    const rows = within(screen.getByTestId('transactions')).getAllByLabelText(/spent ₹/);
    expect(rows.map((r) => String(r.props.accessibilityLabel).split(',')[0])).toEqual([
      'Ola auto',
      'Rapido bike',
    ]);
    expect(
      screen.getByRole('button', { name: 'Only Transport' }).props.accessibilityState,
    ).toMatchObject({
      selected: true,
    });
  });
});

describe('Analytics and budgets', () => {
  it('range totals, category drill-down (AC3), payees', async () => {
    const { store, at } = await moneyStore(SPECS);
    await renderWithStore(store, <AnalyticsScreen now={at('12:00')} />);
    await press('7D', 'radio');
    expect(screen.getByLabelText('Spent, ₹2,789, 5 payments')).toBeOnTheScreen();
    expect(screen.getByLabelText('Received, ₹50,000, income')).toBeOnTheScreen();
    expect(screen.getByLabelText('Avg payment, ₹558, per debit')).toBeOnTheScreen();
    const cats = within(screen.getByTestId('by-category')).getAllByRole('button');
    expect(cats.map((c) => String(c.props.accessibilityLabel).split(':')[0])).toEqual([
      'Food & groceries',
      'Transport',
      'Bills',
    ]);
    await press(/^Transport: ₹980, 35% of spend/);
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/money/transactions',
      params: { category: 'transport' },
    });
    expect(screen.getByLabelText(/^1\. BigBasket, ₹1,240, 1 payment/)).toBeOnTheScreen();
  });

  it('budgets: amber ≥ 80 %, red ≥ 100 %; edit and save', async () => {
    const { store, at } = await moneyStore([
      [0, 1200, 'bills', 'TNEB'],
      [0, 900, 'transport', 'Rapido'],
    ]);
    await renderWithStore(store, <BudgetsScreen now={at('12:00')} />);
    expect(
      within(screen.getByTestId('budget-Bills')).getByText('₹300 left · 80%'),
    ).toBeOnTheScreen();
    expect(
      within(screen.getByTestId('budget-Transport')).getByText('Over by ₹100'),
    ).toBeOnTheScreen();
    expect(screen.getByText(/Categories cover ₹12,800\. ₹5,200 unallocated/)).toBeOnTheScreen();
    await press('Edit budgets');
    await press('Increase Transport budget');
    await press('Transport icon car', 'radio');
    await press('Increase Monthly budget');
    await press('Save budgets');
    expect(queued(store, 'expense_category')).toEqual([
      { op: 'upsert', client_id: 'transport-c', row: { icon: 'car', monthly_budget_inr: 900 } },
    ]);
    expect(queued(store, 'profile').at(-1)?.row).toEqual({ monthly_budget_inr: 18500 });
    expect(
      within(screen.getByTestId('budget-Transport')).getByText('₹0 left · 100%'),
    ).toBeOnTheScreen();
  });
});
