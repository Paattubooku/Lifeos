import { fireEvent, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { renderWithTheme } from '@/test/render';

import { Screen } from '../Screen';
import { Sheet, useSheetClose } from '../Sheet';

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
    // A second close while the first is animating out is ignored.
    await fireEvent.press(scrim);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('the screen-reader escape gesture closes it; Cancel via useSheetClose animates out too', async () => {
    const onClose = jest.fn();
    function Cancel() {
      const close = useSheetClose(() => undefined);
      return <Text onPress={close}>Cancel</Text>;
    }
    await renderWithTheme(
      <Sheet visible onClose={onClose} title="Skip this block?" testID="sheet">
        <Cancel />
      </Sheet>,
    );
    await fireEvent(screen.getByTestId('sheet'), 'accessibilityEscape');
    expect(onClose).toHaveBeenCalledTimes(1);

    const onClose2 = jest.fn();
    await renderWithTheme(
      <Sheet visible onClose={onClose2} title="Other">
        <Cancel />
      </Sheet>,
    );
    await fireEvent.press(screen.getAllByText('Cancel').at(-1)!);
    expect(onClose2).toHaveBeenCalledTimes(1);
  });

  it('owner hiding it: stays mounted for the exit animation, then unmounts', async () => {
    const view = await renderWithTheme(<Sheet visible onClose={jest.fn()} title="Leaving" />);
    expect(screen.getByText('Leaving')).toBeOnTheScreen();
    await view.rerender(<Sheet visible={false} onClose={jest.fn()} title="Leaving" />);
    expect(screen.queryByText('Leaving')).toBeNull();
    await view.rerender(<Sheet visible onClose={jest.fn()} title="Leaving" />);
    expect(screen.getByText('Leaving')).toBeOnTheScreen();
  });

  it('useSheetClose falls back outside a sheet', async () => {
    const fallback = jest.fn();
    function Outside() {
      const close = useSheetClose(fallback);
      return <Text onPress={close}>Close</Text>;
    }
    await renderWithTheme(<Outside />);
    await fireEvent.press(screen.getByText('Close'));
    expect(fallback).toHaveBeenCalled();
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
