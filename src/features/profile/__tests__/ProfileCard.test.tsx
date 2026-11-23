import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTheme } from '@/test/render';

import { ProfileCard, profileLine } from '../components/ProfileCard';

const NOW = Date.parse('2026-11-24T06:00:00Z'); // Tue 11:30 IST

describe('profileLine', () => {
  it('weights, day count and account', () => {
    expect(
      profileLine({
        startWeightKg: 91,
        goalWeightKg: 75,
        onboardedAt: '2026-11-23T01:00:00Z',
        now: NOW,
      }),
    ).toBe('91.0 → 75 kg · day 2 · single account');
  });

  it('skips what is missing', () => {
    expect(profileLine({ startWeightKg: null, goalWeightKg: 75, onboardedAt: null })).toBe(
      'single account',
    );
  });
});

describe('ProfileCard', () => {
  it('shows the name from the email and opens the profile', async () => {
    const onPress = jest.fn();
    await renderWithTheme(
      <ProfileCard
        email="ptr@example.com"
        startWeightKg={91}
        goalWeightKg={75.5}
        onboardedAt={null}
        onPress={onPress}
      />,
    );
    expect(screen.getByText('P')).toBeOnTheScreen();
    await fireEvent.press(
      screen.getByRole('button', { name: 'ptr. 91.0 → 75.5 kg · single account. Edit profile' }),
    );
    expect(onPress).toHaveBeenCalled();
  });

  it('falls back to "You"', async () => {
    await renderWithTheme(
      <ProfileCard
        email={null}
        startWeightKg={null}
        goalWeightKg={null}
        onboardedAt={null}
        onPress={() => undefined}
      />,
    );
    expect(screen.getByText('You')).toBeOnTheScreen();
  });
});
