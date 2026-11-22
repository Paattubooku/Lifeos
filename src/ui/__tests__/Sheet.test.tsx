import { fireEvent, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { renderWithTheme } from '@/test/render';

import { Screen } from '../Screen';
import { Sheet } from '../Sheet';

describe('Sheet', () => {
  it('renders title, subtitle and content when visible; scrim closes it', async () => {
    const onClose = jest.fn();
    await renderWithTheme(
      <Sheet visible onClose={onClose} title="Skip this block?" subtitle="It won't count today.">
        <Text>Reasons</Text>
      </Sheet>,
    );
    expect(screen.getByRole('header', { name: 'Skip this block?' })).toBeOnTheScreen();
    expect(screen.getByText("It won't count today.")).toBeOnTheScreen();
    expect(screen.getByText('Reasons')).toBeOnTheScreen();
    // The scrim sits outside the modal panel, so screen readers skip it…
    const scrim = screen.getByRole('button', { name: 'Close sheet', includeHiddenElements: true });
    await fireEvent.press(scrim);
    expect(onClose).toHaveBeenCalledTimes(1);
    // …and use the escape gesture (two-finger Z / Android back) instead.
    await fireEvent(
      screen.getByRole('header', { name: 'Skip this block?' }).parent!.parent!,
      'accessibilityEscape',
    );
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('renders nothing when hidden', async () => {
    await renderWithTheme(<Sheet visible={false} onClose={jest.fn()} title="Hidden" />);
    expect(screen.queryByText('Hidden')).toBeNull();
  });
});

describe('Screen', () => {
  it('renders a 36 px header and children', async () => {
    await renderWithTheme(
      <Screen title="Today" subtitle="Workday" accessory={<Text>chip</Text>} withTabBar={false}>
        <Text>Body</Text>
      </Screen>,
    );
    expect(screen.getByRole('header', { name: 'Today' })).toHaveStyle({ fontSize: 36 });
    expect(screen.getByText('Workday')).toBeOnTheScreen();
    expect(screen.getByText('chip')).toBeOnTheScreen();
    expect(screen.getByText('Body')).toBeOnTheScreen();
  });
});
