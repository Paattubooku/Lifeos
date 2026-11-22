import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTheme } from '@/test/render';

import { ProgressBar } from '../ProgressBar';
import { palettes } from '../theme';

describe('ProgressBar', () => {
  it('shows label, value, pace marker and a danger caption', async () => {
    await renderWithTheme(
      <ProgressBar
        label="Water"
        valueText="1,400 / 3,000 ml"
        progress={1400 / 3000}
        pace={0.5}
        accent="water"
        caption="100 ml behind. Drink 100 ml now."
        captionTone="danger"
        accessibilityLabel="Water progress"
      />,
    );
    expect(screen.getByRole('progressbar', { name: 'Water progress' })).toHaveAccessibilityValue({
      now: 47,
    });
    expect(screen.getByText('1,400 / 3,000 ml')).toBeOnTheScreen();
    expect(screen.getByTestId('pace-marker')).toHaveStyle({ left: '50%' });
    expect(screen.getByText('100 ml behind. Drink 100 ml now.')).toHaveStyle({
      color: palettes.dark.accents.danger.text,
    });
  });

  it('omits the pace marker and header when not given', async () => {
    await renderWithTheme(
      <ProgressBar
        progress={0.2}
        accent="protein"
        accessibilityLabel="Protein"
        caption="ok"
        captionTone="success"
      />,
    );
    expect(screen.queryByTestId('pace-marker')).toBeNull();
    expect(screen.getByText('ok')).toHaveStyle({ color: palettes.dark.accents.success.text });
  });

  it('sizes the fill from the measured track', async () => {
    await renderWithTheme(
      <ProgressBar
        progress={0.5}
        accent="calories"
        label="Calories"
        accessibilityLabel="Calories"
      />,
    );
    const track = screen.getByRole('progressbar', { name: 'Calories' });
    await fireEvent(track, 'layout', { nativeEvent: { layout: { width: 200, height: 8 } } });
    expect(track).toBeOnTheScreen();
  });
});
