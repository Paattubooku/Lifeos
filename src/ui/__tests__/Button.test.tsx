import { fireEvent, screen } from '@testing-library/react-native';
import { Droplet } from 'lucide-react-native';

import { renderWithTheme } from '@/test/render';

import { Button } from '../Button';
import { palettes } from '../theme';

describe('Button', () => {
  it('renders the label and calls onPress', async () => {
    const onPress = jest.fn();
    await renderWithTheme(
      <Button label="Start Upper A" accessibilityLabel="Start Upper A" onPress={onPress} />,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Start Upper A' }));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Start Upper A')).toBeOnTheScreen();
  });

  it('does not fire when disabled and exposes the disabled state', async () => {
    const onPress = jest.fn();
    await renderWithTheme(
      <Button disabled label="Save" accessibilityLabel="Save" onPress={onPress} />,
    );
    const button = screen.getByRole('button', { name: 'Save' });
    expect(button).toBeDisabled();
    await fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });

  it.each([
    ['primary', palettes.dark.buttonPrimary],
    ['water', palettes.dark.buttonWater],
    ['destructive', palettes.dark.buttonDestructive],
    ['ghost', palettes.dark.ghost],
    ['secondary', palettes.dark.raised],
    ['outline', palettes.dark.raised],
  ] as const)('%s variant uses its token background', async (variant, bg) => {
    await renderWithTheme(
      <Button
        variant={variant}
        icon={Droplet}
        label="Go"
        accessibilityLabel={`Go ${variant}`}
        onPress={jest.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: `Go ${variant}` })).toHaveStyle({
      backgroundColor: bg,
    });
  });

  it('meets the 44 pt minimum touch target at every size', async () => {
    await renderWithTheme(
      <Button size="sm" label="+100 ml" accessibilityLabel="Add 100 ml" onPress={jest.fn()} />,
    );
    expect(screen.getByRole('button', { name: 'Add 100 ml' })).toHaveStyle({
      height: 44,
      minWidth: 44,
    });
  });
});
