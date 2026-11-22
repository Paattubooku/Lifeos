import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTheme } from '@/test/render';

import { Card } from '../Card';
import { StatTile } from '../StatTile';
import { Text } from '../Text';
import { palettes } from '../theme';

describe('Card', () => {
  it('renders kicker, title and children on the raised plane', async () => {
    await renderWithTheme(
      <Card kicker="Next · 5:30 am" title="Workout · Upper A" testID="card">
        <Text>55 min</Text>
      </Card>,
    );
    expect(screen.getByText('Next · 5:30 am')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Workout · Upper A' })).toBeOnTheScreen();
    expect(screen.getByText('55 min')).toBeOnTheScreen();
    expect(screen.getByTestId('card')).toHaveStyle({
      backgroundColor: palettes.dark.raised,
      borderRadius: 16,
      borderColor: palettes.dark.hairline,
    });
  });

  it('is a labelled button when onPress is given', async () => {
    const onPress = jest.fn();
    await renderWithTheme(<Card title="Water" onPress={onPress} accessibilityLabel="Open water" />);
    await fireEvent.press(screen.getByRole('button', { name: 'Open water' }));
    expect(onPress).toHaveBeenCalled();
  });
});

describe('StatTile', () => {
  it('reads label, value and sub-line as one accessible element', async () => {
    await renderWithTheme(
      <StatTile label="Protein" value="32 g" sub="of 150 g" accent="protein" />,
    );
    expect(screen.getByLabelText('Protein, 32 g, of 150 g')).toBeOnTheScreen();
    expect(screen.getByText('32 g')).toHaveStyle({ fontVariant: ['tabular-nums'] });
  });

  it('works without a sub-line or accent', async () => {
    await renderWithTheme(<StatTile label="Coffee" value="1" />);
    expect(screen.getByLabelText('Coffee, 1')).toBeOnTheScreen();
  });
});
