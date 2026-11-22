import { fireEvent, screen } from '@testing-library/react-native';
import { Inbox } from 'lucide-react-native';

import { renderWithTheme } from '@/test/render';

import { Banner } from '../Banner';
import { EmptyState } from '../EmptyState';

describe('Banner', () => {
  it('reads title and body together and runs its action', async () => {
    const onPress = jest.fn();
    await renderWithTheme(
      <Banner
        tone="danger"
        testID="banner"
        title="350 ml behind. Drink 350 ml now."
        body="Pace for 2:20 pm is 1,750 ml."
        action={{ label: 'Drink 350', accessibilityLabel: 'Drink 350 ml', onPress }}
      />,
    );
    expect(screen.getByTestId('banner')).toHaveProp('accessibilityRole', 'alert');
    expect(
      screen.getByLabelText('350 ml behind. Drink 350 ml now. Pace for 2:20 pm is 1,750 ml.'),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Drink 350 ml' }));
    expect(onPress).toHaveBeenCalled();
  });

  it.each(['info', 'warning', 'success'] as const)(
    'renders the %s tone without an alert role',
    async (tone) => {
      await renderWithTheme(
        <Banner
          tone={tone}
          testID="banner"
          title="Template switched to Weekend"
          body="Applies to today only."
        />,
      );
      expect(
        screen.getByLabelText('Template switched to Weekend. Applies to today only.'),
      ).toBeOnTheScreen();
      expect(screen.getByTestId('banner')).not.toHaveProp('accessibilityRole', 'alert');
    },
  );
});

describe('EmptyState', () => {
  it('shows one fact and one action', async () => {
    const onPress = jest.fn();
    await renderWithTheme(
      <EmptyState
        icon={Inbox}
        title="No tasks for today"
        body="Top 3 shows here. Add one in 2 taps."
        action={{ label: 'Add task', accessibilityLabel: 'Add task', onPress }}
      />,
    );
    expect(screen.getByRole('header', { name: 'No tasks for today' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Add task' }));
    expect(onPress).toHaveBeenCalled();
  });

  it('works without body or action', async () => {
    await renderWithTheme(<EmptyState icon={Inbox} title="Nothing here" />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});
