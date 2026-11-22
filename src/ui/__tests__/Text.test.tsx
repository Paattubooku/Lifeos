import { screen } from '@testing-library/react-native';

import { renderWithTheme } from '@/test/render';

import { Text } from '../Text';
import { fonts, palettes } from '../theme';

describe('Text', () => {
  it('uses Inter for body and Plus Jakarta Sans for display sizes', async () => {
    await renderWithTheme(
      <>
        <Text>Body</Text>
        <Text variant="hero">1,400 ml</Text>
      </>,
    );
    expect(screen.getByText('Body')).toHaveStyle({ fontFamily: fonts.body[400], fontSize: 16 });
    expect(screen.getByText('1,400 ml')).toHaveStyle({
      fontFamily: fonts.display[700],
      fontSize: 48,
    });
  });

  it('applies tone, weight, tabular figures, uppercase kicker and strike', async () => {
    await renderWithTheme(
      <>
        <Text tone="secondary" weight={600}>
          Sub
        </Text>
        <Text tone="water" num>
          350
        </Text>
        <Text variant="kicker">Next</Text>
        <Text strike>Old</Text>
        <Text tone="onButton">On</Text>
        <Text tone="onInverse">Inv</Text>
        <Text variant="hero" weight={800}>
          Heavy
        </Text>
        <Text variant="heading" weight={600}>
          Semi
        </Text>
        <Text variant="heading" weight={500}>
          Med
        </Text>
        <Text weight={700}>Bold</Text>
        <Text weight={500}>Medium</Text>
      </>,
    );
    expect(screen.getByText('Sub')).toHaveStyle({
      color: palettes.dark.textSecondary,
      fontFamily: fonts.body[600],
    });
    expect(screen.getByText('350')).toHaveStyle({
      color: palettes.dark.accents.water.text,
      fontVariant: ['tabular-nums'],
    });
    expect(screen.getByText('Next')).toHaveStyle({ textTransform: 'uppercase' });
    expect(screen.getByText('Old')).toHaveStyle({ textDecorationLine: 'line-through' });
    expect(screen.getByText('On')).toHaveStyle({ color: palettes.dark.onButton });
    expect(screen.getByText('Inv')).toHaveStyle({ color: palettes.dark.onInverse });
    expect(screen.getByText('Heavy')).toHaveStyle({ fontFamily: fonts.display[800] });
    expect(screen.getByText('Semi')).toHaveStyle({ fontFamily: fonts.display[600] });
    expect(screen.getByText('Med')).toHaveStyle({ fontFamily: fonts.display[500] });
    expect(screen.getByText('Bold')).toHaveStyle({ fontFamily: fonts.body[700] });
    expect(screen.getByText('Medium')).toHaveStyle({ fontFamily: fonts.body[500] });
  });

  it('switches colours with the theme', async () => {
    await renderWithTheme(<Text>Hello</Text>, 'light');
    expect(screen.getByText('Hello')).toHaveStyle({ color: palettes.light.text });
  });
});
