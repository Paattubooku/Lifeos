import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTheme } from '@/test/render';

import { TimePicker } from '../TimePicker';

describe('TimePicker', () => {
  it('shows the value on three wheels', async () => {
    await renderWithTheme(
      <TimePicker accessibilityLabel="Wake time" value="05:00" onChange={jest.fn()} />,
    );
    expect(screen.getByRole('adjustable', { name: 'Wake time hour' })).toHaveAccessibilityValue({
      text: '5',
    });
    expect(screen.getByRole('adjustable', { name: 'Wake time minute' })).toHaveAccessibilityValue({
      text: '00',
    });
    expect(screen.getByRole('adjustable', { name: 'Wake time am or pm' })).toHaveAccessibilityValue(
      { text: 'am' },
    );
  });

  it('emits 24 h storage time when a row is tapped', async () => {
    const onChange = jest.fn();
    await renderWithTheme(
      <TimePicker accessibilityLabel="Wake time" value="05:00" onChange={onChange} />,
    );
    await fireEvent.press(screen.getByLabelText('Wake time hour 6'));
    expect(onChange).toHaveBeenLastCalledWith('06:00');
    await fireEvent.press(screen.getByLabelText('Wake time minute 30'));
    expect(onChange).toHaveBeenLastCalledWith('05:30');
    await fireEvent.press(screen.getByLabelText('Wake time am or pm pm'));
    expect(onChange).toHaveBeenLastCalledWith('17:00');
  });

  it('steps a wheel with accessibility increment/decrement', async () => {
    const onChange = jest.fn();
    await renderWithTheme(
      <TimePicker accessibilityLabel="Sleep" value="22:00" onChange={onChange} />,
    );
    const hour = screen.getByRole('adjustable', { name: 'Sleep hour' });
    await fireEvent(hour, 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
    expect(onChange).toHaveBeenLastCalledWith('23:00');
    await fireEvent(hour, 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } });
    expect(onChange).toHaveBeenLastCalledWith('21:00');
  });

  it('selects the row a scroll settles on, and ignores no-op changes', async () => {
    const onChange = jest.fn();
    await renderWithTheme(
      <TimePicker accessibilityLabel="Wake" value="05:00" onChange={onChange} />,
    );
    await fireEvent(screen.getByTestId('wheel Wake minute'), 'momentumScrollEnd', {
      nativeEvent: { contentOffset: { y: 40 * 6 } },
    });
    expect(onChange).toHaveBeenLastCalledWith('05:30');
    onChange.mockClear();
    await fireEvent(screen.getByTestId('wheel Wake hour'), 'scrollEndDrag', {
      nativeEvent: { contentOffset: { y: 40 * 4 }, velocity: { y: 0 } },
    });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('snaps an off-step minute to the nearest option', async () => {
    await renderWithTheme(
      <TimePicker accessibilityLabel="Wake" value="05:07" onChange={jest.fn()} />,
    );
    expect(screen.getByRole('adjustable', { name: 'Wake minute' })).toHaveAccessibilityValue({
      text: '05',
    });
  });
});
