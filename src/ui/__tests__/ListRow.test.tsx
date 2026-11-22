import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTheme } from '@/test/render';

import { Checkbox } from '../Checkbox';
import { ListRow } from '../ListRow';

describe('Checkbox', () => {
  it('toggles with a 44×44 hit area', async () => {
    const onToggle = jest.fn();
    await renderWithTheme(
      <Checkbox checked={false} onToggle={onToggle} accessibilityLabel="Complete task" />,
    );
    const box = screen.getByRole('checkbox', { name: 'Complete task' });
    expect(box).not.toBeChecked();
    expect(box).toHaveStyle({ width: 44, height: 44 });
    await fireEvent.press(box);
    expect(onToggle).toHaveBeenCalledWith(true);
  });

  it('unchecks', async () => {
    const onToggle = jest.fn();
    await renderWithTheme(
      <Checkbox checked onToggle={onToggle} accessibilityLabel="Complete task" />,
    );
    expect(screen.getByRole('checkbox', { name: 'Complete task' })).toBeChecked();
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Complete task' }));
    expect(onToggle).toHaveBeenCalledWith(false);
  });
});

describe('ListRow', () => {
  it('completes via the checkbox', async () => {
    const onToggle = jest.fn();
    await renderWithTheme(
      <ListRow title="Pay electricity bill" meta="Due today" onToggle={onToggle} />,
    );
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Complete Pay electricity bill' }));
    expect(onToggle).toHaveBeenCalledWith(true);
    expect(screen.getByText('Due today')).toBeOnTheScreen();
  });

  it('strikes through a done row', async () => {
    await renderWithTheme(<ListRow title="Fix PR" done onToggle={jest.fn()} />);
    expect(screen.getByText('Fix PR')).toHaveStyle({ textDecorationLine: 'line-through' });
  });

  it('offers done / tomorrow / delete as accessibility actions (swipe equivalents)', async () => {
    const onToggle = jest.fn();
    const onTomorrow = jest.fn();
    const onDelete = jest.fn();
    await renderWithTheme(
      <ListRow
        title="Book dentist"
        meta="Before 6 pm"
        metaTone="danger"
        onToggle={onToggle}
        onTomorrow={onTomorrow}
        onDelete={onDelete}
      />,
    );
    const row = screen.getByLabelText('Book dentist, Before 6 pm');
    await fireEvent(row, 'accessibilityAction', { nativeEvent: { actionName: 'done' } });
    await fireEvent(row, 'accessibilityAction', { nativeEvent: { actionName: 'tomorrow' } });
    await fireEvent(row, 'accessibilityAction', { nativeEvent: { actionName: 'delete' } });
    expect(onToggle).toHaveBeenCalledWith(true);
    expect(onTomorrow).toHaveBeenCalled();
    expect(onDelete).toHaveBeenCalled();
  });

  it('swipe right completes the row; swipe left reveals Tomorrow and Delete', async () => {
    const onToggle = jest.fn();
    const onTomorrow = jest.fn();
    const onDelete = jest.fn();
    await renderWithTheme(
      <ListRow
        title="Renew insurance"
        onToggle={onToggle}
        onTomorrow={onTomorrow}
        onDelete={onDelete}
      />,
    );
    expect(screen.getByText('Done')).toBeOnTheScreen();
    await fireEvent(screen.getByTestId('swipeable'), 'swipeableOpen', 'left');
    expect(onToggle).not.toHaveBeenCalled();
    await fireEvent(screen.getByTestId('swipeable'), 'swipeableOpen', 'right');
    expect(onToggle).toHaveBeenCalledWith(true);
    await fireEvent.press(screen.getByRole('button', { name: 'Move Renew insurance to tomorrow' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Delete Renew insurance' }));
    expect(onTomorrow).toHaveBeenCalled();
    expect(onDelete).toHaveBeenCalled();
  });

  it('does not offer swipe-to-done on a row that is already done', async () => {
    await renderWithTheme(<ListRow title="Old" done onToggle={jest.fn()} />);
    expect(screen.queryByText('Done')).toBeNull();
  });

  it('renders without a checkbox when not toggleable', async () => {
    await renderWithTheme(<ListRow title="Read only" />);
    expect(screen.queryByRole('checkbox')).toBeNull();
  });
});
