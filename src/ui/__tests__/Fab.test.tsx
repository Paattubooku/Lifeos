import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTheme } from '@/test/render';

import { Fab } from '../Fab';
import { palettes } from '../theme';

describe('Fab', () => {
  const label = 'Add 200 ml water. Long-press for 500, 750 or custom.';

  it('tap = +200 ml action, in the water colour', async () => {
    const onPress = jest.fn();
    await renderWithTheme(<Fab onPress={onPress} onLongPress={jest.fn()} />);
    const fab = screen.getByRole('button', { name: label });
    await fireEvent.press(fab);
    expect(onPress).toHaveBeenCalled();
    expect(screen.getByText('+200')).toBeOnTheScreen();
    expect(fab).toHaveStyle({ backgroundColor: palettes.dark.buttonWater, width: 60, height: 60 });
  });

  it('long-press opens the sheet and shows the halo until release', async () => {
    const onLongPress = jest.fn();
    await renderWithTheme(<Fab onPress={jest.fn()} onLongPress={onLongPress} />);
    const fab = screen.getByRole('button', { name: label });
    await fireEvent(fab, 'longPress');
    expect(onLongPress).toHaveBeenCalled();
    expect(screen.getByTestId('fab-halo')).toBeOnTheScreen();
    await fireEvent(fab, 'pressOut');
    expect(screen.queryByTestId('fab-halo')).toBeNull();
  });

  it('exposes the long-press as an accessibility action', async () => {
    const onLongPress = jest.fn();
    await renderWithTheme(<Fab onPress={jest.fn()} onLongPress={onLongPress} />);
    await fireEvent(screen.getByRole('button', { name: label }), 'accessibilityAction', {
      nativeEvent: { actionName: 'longpress' },
    });
    expect(onLongPress).toHaveBeenCalled();
  });
});
