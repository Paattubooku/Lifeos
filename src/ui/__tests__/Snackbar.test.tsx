import { act, fireEvent, screen } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';

import { renderWithTheme } from '@/test/render';

import { snackbarEnter, snackbarExit, SnackbarProvider, useSnackbar } from '../Snackbar';

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

describe('Snackbar motion', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('shows the countdown line only while Undo is offered', async () => {
    await renderWithTheme(
      <SnackbarProvider>
        <Trigger onUndo={jest.fn()} />
      </SnackbarProvider>,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Delete' }));
    expect(screen.getByTestId('snackbar-countdown')).toBeOnTheScreen();
  });

  it('no countdown without an action', async () => {
    await renderWithTheme(
      <SnackbarProvider>
        <Trigger />
      </SnackbarProvider>,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Delete' }));
    expect(screen.queryByTestId('snackbar-countdown')).toBeNull();
  });

  it('a new message replaces the current one and restarts the 5 s', async () => {
    function Two() {
      const show = useSnackbar();
      return (
        <>
          <Text onPress={() => show({ message: 'First' })}>one</Text>
          <Text onPress={() => show({ message: 'Second' })}>two</Text>
        </>
      );
    }
    await renderWithTheme(
      <SnackbarProvider>
        <Two />
      </SnackbarProvider>,
    );
    await fireEvent.press(screen.getByText('one'));
    await act(async () => {
      jest.advanceTimersByTime(4000);
    });
    await fireEvent.press(screen.getByText('two'));
    expect(screen.queryByText('First')).toBeNull();
    await act(async () => {
      jest.advanceTimersByTime(4000);
    });
    expect(screen.getByText('Second')).toBeOnTheScreen();
  });

  it('swipe sideways dismisses; a short swipe springs back', async () => {
    await renderWithTheme(
      <SnackbarProvider>
        <Trigger onUndo={jest.fn()} />
      </SnackbarProvider>,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Delete' }));
    await act(async () => {
      fireGestureHandler(getByGestureTestId('snackbar-swipe'), [
        { state: State.BEGAN, translationX: 0 },
        { state: State.ACTIVE, translationX: 40 },
        { state: State.END, translationX: 40, velocityX: 100 },
      ]);
    });
    expect(screen.getByText('Deleted 300 ml · 12:10 pm')).toBeOnTheScreen();
    await act(async () => {
      fireGestureHandler(getByGestureTestId('snackbar-swipe'), [
        { state: State.BEGAN, translationX: 0 },
        { state: State.ACTIVE, translationX: 140 },
        { state: State.END, translationX: 140, velocityX: 100 },
      ]);
      jest.advanceTimersByTime(50); // the off-screen slide's callback hops to JS
    });
    expect(screen.queryByText('Deleted 300 ml · 12:10 pm')).toBeNull();
  });

  it('enter rises and grows without overshoot; exit fades and drops', () => {
    const enter = snackbarEnter({} as never);
    expect(enter.initialValues).toEqual({
      opacity: 0,
      transform: [{ translateY: 16 }, { scale: 0.96 }],
    });
    expect(enter.animations.transform).toEqual([{ translateY: 0 }, { scale: 1 }]);
    const exit = snackbarExit({} as never);
    expect(exit.animations).toEqual({
      opacity: 0,
      transform: [{ translateY: 10 }, { scale: 0.98 }],
    });
  });
});
