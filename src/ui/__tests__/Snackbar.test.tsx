import { act, fireEvent, screen } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';

import { renderWithTheme } from '@/test/render';

import { SnackbarProvider, useSnackbar } from '../Snackbar';

function Trigger({ onUndo }: { onUndo?: () => void }) {
  const show = useSnackbar();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Delete"
      onPress={() =>
        show({ message: 'Deleted 300 ml · 12:10 pm', actionLabel: 'Undo', onAction: onUndo })
      }
    >
      <Text>Delete</Text>
    </Pressable>
  );
}

describe('Snackbar', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('shows the message with Undo and runs the undo action', async () => {
    const onUndo = jest.fn();
    await renderWithTheme(
      <SnackbarProvider>
        <Trigger onUndo={onUndo} />
      </SnackbarProvider>,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Delete' }));
    expect(screen.getByText('Deleted 300 ml · 12:10 pm')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Undo: Deleted 300 ml · 12:10 pm' }));
    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Deleted 300 ml · 12:10 pm')).toBeNull();
  });

  it('hides itself after 5 s', async () => {
    await renderWithTheme(
      <SnackbarProvider>
        <Trigger onUndo={jest.fn()} />
      </SnackbarProvider>,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Delete' }));
    await act(async () => {
      jest.advanceTimersByTime(4900);
    });
    expect(screen.getByText('Deleted 300 ml · 12:10 pm')).toBeOnTheScreen();
    await act(async () => {
      jest.advanceTimersByTime(200);
    });
    expect(screen.queryByText('Deleted 300 ml · 12:10 pm')).toBeNull();
  });

  it('shows a message without an action button', async () => {
    await renderWithTheme(
      <SnackbarProvider>
        <Trigger />
      </SnackbarProvider>,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Delete' }));
    expect(screen.queryByRole('button', { name: /Undo/ })).toBeNull();
  });
});
