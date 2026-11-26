import { act, fireEvent, screen } from '@testing-library/react-native';

import { renderWithStore, seededStore } from '@/test/profileFixtures';

import { KeyboardTestScreen } from '../KeyboardTestScreen';

const mockRouter = { push: jest.fn(), back: jest.fn(), replace: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));

describe('Keyboard test (development)', () => {
  it('logs focus and blur of each box in the timeline', async () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const { store } = await seededStore();
    await renderWithStore(store, <KeyboardTestScreen />);
    await act(async () => {
      await fireEvent(screen.getByLabelText('Plain test box'), 'focus');
      await fireEvent(screen.getByLabelText('Plain test box'), 'blur');
      await fireEvent(screen.getByLabelText('3 · The app’s text field'), 'focus');
    });
    expect(screen.getByText(/box 1 focus$/)).toBeOnTheScreen();
    expect(screen.getByText(/box 1 blur$/)).toBeOnTheScreen();
    expect(screen.getByText(/box 3 focus$/)).toBeOnTheScreen();
    expect(log).toHaveBeenCalledWith(
      expect.stringMatching(/^\[LifeOS keyboard\] \+\d+\.\d{2}s box 1 focus$/),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(mockRouter.back).toHaveBeenCalled();
    log.mockRestore();
  });
});
