import { screen } from '@testing-library/react-native';

import { renderWithTheme } from '@/test/render';

import { clamp01, Ring, TripleRing } from '../Ring';
import { Text } from '../Text';

describe('Ring', () => {
  it('exposes progress to screen readers and renders centre content', async () => {
    await renderWithTheme(
      <Ring progress={0.45} accent="primary" accessibilityLabel="Routine">
        <Text>45%</Text>
      </Ring>,
    );
    const ring = screen.getByRole('progressbar', { name: 'Routine' });
    expect(ring).toHaveAccessibilityValue({ min: 0, max: 100, now: 45 });
    expect(screen.getByText('45%')).toBeOnTheScreen();
  });

  it('clamps out-of-range progress', async () => {
    await renderWithTheme(<Ring progress={1.4} accent="water" accessibilityLabel="Water" />);
    expect(screen.getByRole('progressbar', { name: 'Water' })).toHaveAccessibilityValue({
      now: 100,
    });
  });

  it('renders the triple day-score ring', async () => {
    await renderWithTheme(
      <TripleRing
        rings={[
          { progress: 0.78, accent: 'primary' },
          { progress: 0.5, accent: 'water' },
          { progress: 0.3, accent: 'protein' },
        ]}
        accessibilityLabel="Day score"
      >
        <Text>78%</Text>
      </TripleRing>,
    );
    expect(screen.getByRole('progressbar', { name: 'Day score' })).toHaveAccessibilityValue({
      now: 78,
    });
  });

  it('clamp01 handles bounds and non-finite values', () => {
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(0.3)).toBe(0.3);
    expect(clamp01(2)).toBe(1);
    expect(clamp01(Number.NaN)).toBe(0);
    expect(clamp01(Infinity)).toBe(0);
  });
});
