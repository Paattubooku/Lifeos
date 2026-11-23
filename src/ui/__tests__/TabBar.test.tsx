import { fireEvent, screen } from '@testing-library/react-native';
import type { BottomTabBarProps } from 'expo-router/js-tabs';

import { renderWithTheme } from '@/test/render';

import { TabBar, TabBarItems, tabBarClearance } from '../TabBar';

const routes = ['today', 'food', 'train', 'progress', 'more'].map((name) => ({
  key: `${name}-key`,
  name,
}));

describe('TabBarItems', () => {
  it('renders the five tabs with the active one selected', async () => {
    await renderWithTheme(<TabBarItems routes={routes} activeIndex={0} onSelect={jest.fn()} />);
    for (const label of ['Today', 'Food', 'Train', 'Progress', 'More']) {
      expect(screen.getByRole('tab', { name: label })).toBeOnTheScreen();
    }
    expect(screen.getByRole('tab', { name: 'Today' })).toBeSelected();
    expect(screen.getByRole('tab', { name: 'Food' })).not.toBeSelected();
  });

  it('reports the pressed tab and skips unknown routes', async () => {
    const onSelect = jest.fn();
    await renderWithTheme(
      <TabBarItems
        routes={[...routes, { key: 'x', name: 'unknown' }]}
        activeIndex={0}
        onSelect={onSelect}
      />,
    );
    await fireEvent.press(screen.getByRole('tab', { name: 'Progress' }));
    expect(onSelect).toHaveBeenCalledWith(3);
    expect(screen.getAllByRole('tab')).toHaveLength(5);
  });
});

describe('TabBar', () => {
  it('navigates to a different tab only', async () => {
    const navigateToTab = jest.fn();
    const props = {
      state: { index: 1, routes },
      navigateToTab,
    } as unknown as BottomTabBarProps;
    await renderWithTheme(<TabBar {...props} />);
    await fireEvent.press(screen.getByRole('tab', { name: 'Train' }));
    expect(navigateToTab).toHaveBeenCalledWith('train-key');
    navigateToTab.mockClear();
    await fireEvent.press(screen.getByRole('tab', { name: 'Food' }));
    expect(navigateToTab).not.toHaveBeenCalled();
  });

  it('reserves room for the floating bar above the home indicator', () => {
    expect(tabBarClearance(34)).toBe(56 + 34 + 16);
    expect(tabBarClearance(0)).toBe(56 + 12 + 16);
  });
});

describe('TabBar badge', () => {
  it('shows a red dot on More when there is a sync issue', async () => {
    await renderWithTheme(
      <TabBarItems routes={routes} activeIndex={0} onSelect={jest.fn()} badges={{ more: true }} />,
    );
    expect(screen.getByTestId('tab-badge-more')).toBeOnTheScreen();
    expect(screen.getByRole('tab', { name: 'More, needs attention' })).toBeOnTheScreen();
    expect(screen.queryByTestId('tab-badge-today')).toBeNull();
  });
});
