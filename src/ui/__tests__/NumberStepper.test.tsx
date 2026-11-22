import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTheme } from '@/test/render';

import { nextStepValue, NumberStepper } from '../NumberStepper';

describe('nextStepValue', () => {
  it('steps and clamps', () => {
    expect(nextStepValue(350, 1, { step: 50, min: 50, max: 2000 })).toBe(400);
    expect(nextStepValue(50, -1, { step: 50, min: 50, max: 2000 })).toBe(50);
    expect(nextStepValue(1980, 1, { step: 50, min: 50, max: 2000 })).toBe(2000);
  });

  it('avoids floating-point drift with decimals', () => {
    expect(nextStepValue(91.0, 1, { step: 0.1, decimals: 1 })).toBe(91.1);
    expect(nextStepValue(0.3, -1, { step: 0.1, decimals: 1 })).toBe(0.2);
  });

  it('supports a step rule function (dumbbell: 0.5 below 10 kg, 1 above)', () => {
    const rule = (v: number, d: 1 | -1) => (d === 1 ? (v < 10 ? 0.5 : 1) : v <= 10 ? 0.5 : 1);
    expect(nextStepValue(9.5, 1, { step: rule, decimals: 1 })).toBe(10);
    expect(nextStepValue(10, 1, { step: rule, decimals: 1 })).toBe(11);
    expect(nextStepValue(10, -1, { step: rule, decimals: 1 })).toBe(9.5);
  });

  it('defaults to step 1 with no bounds', () => {
    expect(nextStepValue(0, -1, {})).toBe(-1);
  });
});

describe('NumberStepper', () => {
  it('increments and decrements with labelled buttons', async () => {
    const onChange = jest.fn();
    await renderWithTheme(
      <NumberStepper
        accessibilityLabel="Water"
        value={350}
        onChange={onChange}
        step={50}
        min={50}
        max={2000}
        unit="ml"
      />,
    );
    expect(screen.getByText('350')).toBeOnTheScreen();
    expect(screen.getByText('ml')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Increase Water' }));
    expect(onChange).toHaveBeenLastCalledWith(400);
    await fireEvent.press(screen.getByRole('button', { name: 'Decrease Water' }));
    expect(onChange).toHaveBeenLastCalledWith(300);
  });

  it('disables the control at a bound', async () => {
    const onChange = jest.fn();
    await renderWithTheme(
      <NumberStepper
        accessibilityLabel="Water"
        value={2000}
        onChange={onChange}
        step={50}
        min={50}
        max={2000}
      />,
    );
    const plus = screen.getByRole('button', { name: 'Increase Water' });
    expect(plus).toBeDisabled();
    await fireEvent.press(plus);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('is adjustable for screen readers and shows decimals', async () => {
    const onChange = jest.fn();
    await renderWithTheme(
      <NumberStepper
        accessibilityLabel="Weight"
        value={91}
        onChange={onChange}
        step={0.1}
        decimals={1}
        unit="kg"
      />,
    );
    const adjustable = screen.getByRole('adjustable', { name: 'Weight' });
    expect(adjustable).toHaveAccessibilityValue({ text: '91.0 kg' });
    await fireEvent(adjustable, 'accessibilityAction', {
      nativeEvent: { actionName: 'increment' },
    });
    expect(onChange).toHaveBeenLastCalledWith(91.1);
    await fireEvent(adjustable, 'accessibilityAction', {
      nativeEvent: { actionName: 'decrement' },
    });
    expect(onChange).toHaveBeenLastCalledWith(90.9);
  });
});
