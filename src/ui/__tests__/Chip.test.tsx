import { fireEvent, screen } from '@testing-library/react-native';
import { Check, ChevronDown } from 'lucide-react-native';

import { renderWithTheme } from '@/test/render';

import { Chip, StatusChip } from '../Chip';
import { SegmentedToggle } from '../SegmentedToggle';
import { palettes } from '../theme';

describe('Chip', () => {
  it('is a 44-tall selectable pill', async () => {
    const onPress = jest.fn();
    await renderWithTheme(
      <>
        <Chip
          label="Sick"
          selected
          leadingIcon={Check}
          accessibilityLabel="Reason sick"
          onPress={onPress}
        />
        <Chip
          label="Workday"
          trailingIcon={ChevronDown}
          accessibilityLabel="Template"
          onPress={jest.fn()}
        />
      </>,
    );
    const sick = screen.getByRole('button', { name: 'Reason sick' });
    expect(sick).toBeSelected();
    expect(sick).toHaveStyle({ minHeight: 44, backgroundColor: palettes.dark.buttonPrimary });
    expect(screen.getByRole('button', { name: 'Template' })).not.toBeSelected();
    await fireEvent.press(sick);
    expect(onPress).toHaveBeenCalled();
  });
});

describe('StatusChip', () => {
  it('uses the accent tint and text', async () => {
    await renderWithTheme(
      <>
        <StatusChip label="Overdue 30 min" tone="danger" />
        <StatusChip label="NOW" tone="primary" beacon />
        <StatusChip label="Skipped" />
      </>,
    );
    expect(screen.getByText('Overdue 30 min')).toHaveStyle({
      color: palettes.dark.accents.danger.text,
    });
    expect(screen.getByLabelText('Overdue 30 min')).toHaveStyle({
      backgroundColor: palettes.dark.accents.danger.tint,
    });
    expect(screen.getByLabelText('Skipped')).toHaveStyle({
      backgroundColor: palettes.dark.recessed,
    });
    expect(screen.getByText('NOW')).toBeOnTheScreen();
  });
});

describe('SegmentedToggle', () => {
  const options = [
    { value: 'workday', label: 'Workday' },
    { value: 'weekend', label: 'Weekend' },
    { value: 'rest', label: 'Rest day' },
  ] as const;

  it('marks the active segment and reports changes', async () => {
    const onChange = jest.fn();
    await renderWithTheme(
      <SegmentedToggle
        accessibilityLabel="Template"
        options={options}
        value="workday"
        onChange={onChange}
      />,
    );
    expect(screen.getByRole('radio', { name: 'Workday' })).toBeChecked();
    await fireEvent.press(screen.getByRole('radio', { name: 'Weekend' }));
    expect(onChange).toHaveBeenCalledWith('weekend');
  });

  it('ignores a press on the active segment', async () => {
    const onChange = jest.fn();
    await renderWithTheme(
      <SegmentedToggle
        accessibilityLabel="Template"
        options={options}
        value="rest"
        onChange={onChange}
      />,
    );
    await fireEvent.press(screen.getByRole('radio', { name: 'Rest day' }));
    expect(onChange).not.toHaveBeenCalled();
  });
});
