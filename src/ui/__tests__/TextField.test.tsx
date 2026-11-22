import { fireEvent, screen } from '@testing-library/react-native';
import { Mail } from 'lucide-react-native';

import { renderWithTheme } from '@/test/render';

import { TextField } from '../TextField';
import { palettes } from '../theme';

describe('TextField', () => {
  it('is labelled and reports text changes', async () => {
    const onChangeText = jest.fn();
    await renderWithTheme(
      <TextField label="Email" icon={Mail} value="" onChangeText={onChangeText} />,
    );
    expect(screen.getByText('Email')).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText('Email'), 'ptr@example.com');
    expect(onChangeText).toHaveBeenCalledWith('ptr@example.com');
  });

  it('hides a secure value until "Show password" is pressed', async () => {
    await renderWithTheme(
      <TextField label="Password" secure value="hunter2" onChangeText={jest.fn()} />,
    );
    expect(screen.getByLabelText('Password')).toHaveProp('secureTextEntry', true);
    await fireEvent.press(screen.getByRole('button', { name: 'Show password' }));
    expect(screen.getByLabelText('Password')).toHaveProp('secureTextEntry', false);
    expect(screen.getByRole('button', { name: 'Hide password' })).toBeOnTheScreen();
  });

  it('shows an error and tracks focus', async () => {
    const onFocus = jest.fn();
    const onBlur = jest.fn();
    await renderWithTheme(
      <TextField
        label="Email"
        value="x"
        error="Enter your email address."
        onFocus={onFocus}
        onBlur={onBlur}
      />,
    );
    expect(screen.getByText('Enter your email address.')).toHaveStyle({
      color: palettes.dark.accents.danger.text,
    });
    await fireEvent(screen.getByLabelText('Email'), 'focus');
    await fireEvent(screen.getByLabelText('Email'), 'blur');
    expect(onFocus).toHaveBeenCalled();
    expect(onBlur).toHaveBeenCalled();
  });

  it('focus without an error highlights in cobalt', async () => {
    await renderWithTheme(<TextField label="Email" value="" />);
    await fireEvent(screen.getByLabelText('Email'), 'focus');
    expect(screen.getByLabelText('Email')).toBeOnTheScreen();
  });
});
