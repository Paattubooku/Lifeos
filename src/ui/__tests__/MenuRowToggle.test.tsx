import { fireEvent, screen } from '@testing-library/react-native';
import { Clock } from 'lucide-react-native';

import { renderWithTheme } from '@/test/render';

import { MenuRow } from '../MenuRow';
import { Screen } from '../Screen';
import { Toggle } from '../Toggle';

describe('MenuRow', () => {
  it('reads title + line and opens', async () => {
    const onPress = jest.fn();
    await renderWithTheme(
      <MenuRow icon={Clock} title="Routine" sub="Workday · 12 blocks" onPress={onPress} divider />,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Routine. Workday · 12 blocks' }));
    expect(onPress).toHaveBeenCalled();
  });

  it('title only', async () => {
    await renderWithTheme(
      <MenuRow icon={Clock} accent="water" title="Water" onPress={() => undefined} />,
    );
    expect(screen.getByRole('button', { name: 'Water' })).toBeOnTheScreen();
  });
});

describe('Toggle', () => {
  it('switches and reports the value', async () => {
    const onChange = jest.fn();
    await renderWithTheme(
      <Toggle
        label="Notify at start"
        hint="Reminder at 1:00 pm."
        value={false}
        onChange={onChange}
        testID="t"
      />,
    );
    expect(screen.getByText('Reminder at 1:00 pm.')).toBeOnTheScreen();
    await fireEvent(screen.getByTestId('t'), 'valueChange', true);
    expect(onChange).toHaveBeenCalledWith(true);
  });
});

describe('Screen back + action', () => {
  it('renders the back link and the action', async () => {
    const onBack = jest.fn();
    await renderWithTheme(
      <Screen
        title="Routine"
        back={{ label: 'More', onPress: onBack }}
        action={<></>}
        withTabBar={false}
      />,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Back to More' }));
    expect(onBack).toHaveBeenCalled();
  });
});
